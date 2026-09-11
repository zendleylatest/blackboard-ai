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

export const deleteDependentRows = async (
    connection,
    schema,
    parentTable,
    parentColumn,
    parentValue,
    ancestry = new Set()
) => {
    const nodeKey = `${parentTable}.${parentColumn}`;
    if (ancestry.has(nodeKey)) {
        throw new Error(`Cyclic foreign-key dependency detected at ${nodeKey}.`);
    }
    const nextAncestry = new Set(ancestry).add(nodeKey);
    const references = await getReferences(
        connection,
        schema,
        parentTable,
        parentColumn
    );

    for (const reference of references) {
        const childTable = reference.child_table;
        const childColumn = reference.child_column;
        const primaryKey = await getPrimaryKey(connection, schema, childTable);
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
                nextAncestry
            );
        }

        await connection.execute(
            `DELETE FROM ${quoteIdentifier(childTable)}
             WHERE ${quoteIdentifier(childColumn)} = ?`,
            [parentValue]
        );
    }
};
