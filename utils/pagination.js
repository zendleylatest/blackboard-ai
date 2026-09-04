export const PAGE_SIZE = 20;

export const getPage = (value) => Math.max(1, Number(value) || 1);

export const paginatedResponse = ({ req, count, results, page }) => {
    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

    const pageUrl = (targetPage) => {
        if (targetPage < 1 || targetPage > totalPages) return null;

        const url = new URL(
            req.originalUrl,
            `${req.protocol}://${req.get("host")}`
        );

        if (targetPage === 1) {
            url.searchParams.delete("page");
        } else {
            url.searchParams.set("page", String(targetPage));
        }

        return url.toString();
    };

    return {
        count,
        next: page < totalPages ? pageUrl(page + 1) : null,
        previous: page > 1 ? pageUrl(page - 1) : null,
        results,
    };
};
