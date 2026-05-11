import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as Icons from "lucide-react";
import Link from "next/link";

interface ModuleCardProps {
  id: string;
  name: string;
  icon: string;
  problem: string;
  solution: string;
  integratesWith: string[];
  highlight?: string;
}

export function ModuleCard({
  id,
  name,
  icon,
  problem,
  solution,
  integratesWith,
  highlight,
}: ModuleCardProps) {
  // Map icon name to lucide icon component
  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] || Icons.Zap;

  return (
    <Card
      className="h-full border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300"
      data-module-name={id}
    >
      <CardHeader>
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <IconComponent className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{name}</CardTitle>
          </div>
        </div>
        {highlight && (
          <div className="inline-block px-3 py-1 bg-accent rounded-full text-xs font-medium text-primary mb-3">
            {highlight}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Problem */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Problem
          </p>
          <p className="text-sm text-foreground">{problem}</p>
        </div>

        {/* Solution */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Solution
          </p>
          <p className="text-sm text-foreground">{solution}</p>
        </div>

        {/* Integrations */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Integrates With
          </p>
          <div className="flex flex-wrap gap-2">
            {integratesWith.map((integration) => (
              <span
                key={integration}
                className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground"
              >
                {integration}
              </span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link href="#" className="block pt-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            data-cta-type="module-detail"
          >
            Learn More
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
