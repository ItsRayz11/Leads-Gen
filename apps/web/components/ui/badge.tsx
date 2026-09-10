import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import type { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        primary: "border-primary/30 bg-primary/15 text-primary",
        success: "border-success/30 bg-success/15 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning",
        destructive: "border-destructive/30 bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const TIER_VARIANT: Record<string, BadgeProps["variant"]> = {
  "A+": "success",
  A: "success",
  B: "primary",
  C: "warning",
  "Low Priority": "outline",
};

export function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <Badge variant="outline">—</Badge>;
  return <Badge variant={TIER_VARIANT[tier] ?? "default"}>{tier}</Badge>;
}

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  new: "outline",
  researching: "primary",
  qualified: "primary",
  contacted: "primary",
  follow_up: "warning",
  replied: "success",
  meeting: "success",
  negotiation: "success",
  won: "success",
  no_response: "outline",
  rejected: "destructive",
  not_interested: "destructive",
  not_a_fit: "destructive",
  lost: "destructive",
  on_hold: "warning",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

const FRESHNESS_VARIANT: Record<string, BadgeProps["variant"]> = {
  fresh: "success",
  recent: "primary",
  aging: "warning",
  stale: "destructive",
  unknown: "outline",
};

export function FreshnessBadge({ freshness }: { freshness: string | null }) {
  const value = freshness ?? "unknown";
  return <Badge variant={FRESHNESS_VARIANT[value] ?? "outline"}>{value}</Badge>;
}

const VERIFICATION_VARIANT: Record<string, BadgeProps["variant"]> = {
  verified: "success",
  partially_verified: "primary",
  needs_verification: "warning",
  unverified: "outline",
};

export function VerificationBadge({ status }: { status: string | null }) {
  const value = status ?? "unverified";
  return <Badge variant={VERIFICATION_VARIANT[value] ?? "outline"}>{value.replace(/_/g, " ")}</Badge>;
}
