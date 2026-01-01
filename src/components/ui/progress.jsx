import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({
    className,
    value,
    ...props
}) {
    return (
        <div
            data-slot="progress"
            className={cn(
                "bg-muted relative h-2 w-full overflow-hidden rounded-full",
                className
            )}
            {...props}>
            <div
                data-slot="progress-indicator"
                className="bg-primary h-full w-full flex-1 transition-all duration-300 ease-out"
                style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
            />
        </div>
    );
}

export { Progress }
