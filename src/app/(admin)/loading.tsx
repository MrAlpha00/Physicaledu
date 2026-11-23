import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-7 sm:px-8" aria-busy="true" aria-label="Loading administration">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-4 h-10 w-1/3 max-w-lg" />
      <Skeleton className="mt-6 h-10 w-full max-w-md" />
      <div className="mt-8 overflow-hidden border border-navy/10">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="m-3 h-8" />
        ))}
      </div>
    </div>
  );
}
