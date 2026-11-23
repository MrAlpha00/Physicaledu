import { Skeleton } from "@/components/ui/skeleton";

export default function StudentLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8" aria-busy="true" aria-label="Loading your workspace">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-4 h-10 w-1/2 max-w-md" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36" />
        ))}
      </div>
    </div>
  );
}
