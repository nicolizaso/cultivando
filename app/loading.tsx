import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-12 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <DashboardSkeleton />
    </div>
  );
}
