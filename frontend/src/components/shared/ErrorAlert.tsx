import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 shadow-card">
      <CardContent className="flex items-center gap-4 py-4">
        <AlertCircle className="size-6 text-destructive shrink-0" />
        <p className="text-sm flex-1">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
