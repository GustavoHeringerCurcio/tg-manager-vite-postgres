import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 ring-1 ring-destructive/10 animate-fade-in">
      <div className="flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10 shrink-0">
          <AlertCircle className="size-4 text-destructive" />
        </div>
        <p className="text-sm flex-1">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </Card>
  );
}
