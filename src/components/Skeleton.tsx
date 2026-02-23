export default function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-surface-700 rounded-lg ${className}`} />;
}

export function SkeletonCard() {
    return (
        <div className="bg-surface-800 rounded-xl p-4 space-y-3 border border-surface-700">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full" />
        </div>
    );
}
