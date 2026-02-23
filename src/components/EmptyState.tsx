export default function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-surface-400">
            <span className="text-5xl mb-4">{icon}</span>
            <p className="text-lg font-medium">{title}</p>
            {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
        </div>
    );
}
