import { useState } from "react";

export function usePagination<T>(items: readonly T[], pageSize = 10) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageCount,
    pageSize,
    totalItems: items.length,
    setPage: (nextPage: number) => setRequestedPage(Math.max(1, Math.min(nextPage, pageCount))),
  };
}