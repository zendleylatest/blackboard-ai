// Generic, schema-driven cascade delete.
//
// Some FK constraints on the live database were created without
// ON DELETE CASCADE even though the corresponding Django models declare
// CASCADE (e.g. api_chatattachment.uploader_id), so a bare
// `DELETE FROM <parent> WHERE <pk> = ?` can fail with a foreign-key
// constraint error. This walks information_schema.KEY_COLUMN_USAGE to
// find every table referencing the given row (recursively, children of
// children included) and deletes them bottom-up first, regardless of
// whether the underlying constraint actually cascades.

export const quoteIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;

const getReferences = async (connection, schema, table, column) => {
    const [rows] = await connection.execute(
        `
        SELECT k.TABLE_NAME AS child_table, k.COLUMN_NAME AS child_column
        FROM information_schema.KEY_COLUMN_USAGE k
        WHERE k.CONSTRAINT_SCHEMA = ?
          AND k.REFERENCED_TABLE_NAME = ?
          AND k.REFERENCED_COLUMN_NAME = ?
        ORDER BY k.TABLE_NAME, k.COLUMN_NAME
        `,
        [schema, table, column]
    );
    return rows;
};

// Cheap existence check: does anything at all reference this table? Leaf
// tables (nothing points to them) can be bulk-deleted by the parent FK
// column directly with no need to resolve a primary key or walk their rows
// one by one — this matters both for correctness (some tables, e.g. M2M
// "through" tables, don't have a single-column primary key, which used to
// make the whole cascade throw) and for performance (a user with a lot of
// chat/flashcard/quiz history could otherwise trigger a per-row recursive
// walk deep enough to time out the request).
const hasAnyReferences = async (connection, schema, table) => {
    const [rows] = await connection.execute(
        `
        SELECT 1
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_SCHEMA = ?
          AND REFERENCED_TABLE_NAME = ?
        LIMIT 1
        `,
        [schema, table]
    );
    return rows.length > 0;
};

const getPrimaryKey = async (connection, schema, table) => {
    const [rows] = await connection.execute(
        `
        SELECT COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE CONSTRAINT_SCHEMA = ?
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION
        `,
        [schema, table]
    );
    if (rows.length !== 1) {
        throw new Error(`Cannot safely cascade deletion through ${table}.`);
    }
    return rows[0].COLUMN_NAME;
};

// Table structure (which tables reference it, whether it has children of its
// own, its primary key) is identical for every row processed in a single
// cascade — only the row values differ. Without caching, a user with (say)
// a thousand chat messages triggered a thousand repeats of the *same*
// information_schema queries for "does api_chatmessage have children?",
// "what's api_chatattachment's primary key?", etc. — that redundant
// round-trip volume, not any single slow query, was the real cost behind
// account deletion taking long enough to feel hung. Caching by table name
// for the lifetime of one deleteDependentRows() call (shared across the
// whole recursion via the `cache` param) cuts this from O(rows) to O(tables)
// introspection queries.
const getCachedReferences = async (connection, schema, table, column, cache) => {
    const key = `refs:${table}.${column}`;
    if (!cache.has(key)) {
        cache.set(key, await getReferences(connection, schema, table, column));
    }
    return cache.get(key);
};

const getCachedHasAnyReferences = async (connection, schema, table, cache) => {
    const key = `hasRefs:${table}`;
    if (!cache.has(key)) {
        cache.set(key, await hasAnyReferences(connection, schema, table));
    }
    return cache.get(key);
};

const getCachedPrimaryKey = async (connection, schema, table, cache) => {
    const key = `pk:${table}`;
    if (!cache.has(key)) {
        cache.set(key, await getPrimaryKey(connection, schema, table));
    }
    return cache.get(key);
};

export const deleteDependentRows = async (
    connection,
    schema,
    parentTable,
    parentColumn,
    parentValue,
    ancestry = new Set(),
    cache = new Map()
) => {
    const nodeKey = `${parentTable}.${parentColumn}`;
    if (ancestry.has(nodeKey)) {
        throw new Error(`Cyclic foreign-key dependency detected at ${nodeKey}.`);
    }
    const nextAncestry = new Set(ancestry).add(nodeKey);
    const references = await getCachedReferences(
        connection,
        schema,
        parentTable,
        parentColumn,
        cache
    );

    for (const reference of references) {
        const childTable = reference.child_table;
        const childColumn = reference.child_column;

        if (await getCachedHasAnyReferences(connection, schema, childTable, cache)) {
            const primaryKey = await getCachedPrimaryKey(connection, schema, childTable, cache);
            const [children] = await connection.execute(
                `SELECT ${quoteIdentifier(primaryKey)} AS id
                 FROM ${quoteIdentifier(childTable)}
                 WHERE ${quoteIdentifier(childColumn)} = ?`,
                [parentValue]
            );

            for (const child of children) {
                await deleteDependentRows(
                    connection,
                    schema,
                    childTable,
                    primaryKey,
                    child.id,
                    nextAncestry,
                    cache
                );
            }
        }

        await connection.execute(
            `DELETE FROM ${quoteIdentifier(childTable)}
             WHERE ${quoteIdentifier(childColumn)} = ?`,
            [parentValue]
        );
    }
};
