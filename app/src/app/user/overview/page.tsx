/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { AreaChart, Area, CartesianGrid, XAxis, BarChart, Bar } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { StatusBanner } from "@/components/status-banner";

// =====================================================
// USER OVERVIEW — EMPTY STATE VERSION
// =====================================================

export default function UserOverviewPage() {
  // Empty placeholders
  const emptyBarData: any[] = [];
  const emptyAreaData: any[] = [];

  const [recordRange, setRecordRange] = React.useState("30d");
  const [grantRange, setGrantRange] = React.useState("30d");

  return (
    <main className="space-y-8 mb-5">
      {/* ====================== STATUS BANNER ====================== */}
      <StatusBanner type="warning">
        ⚠️ This Page Is Currently Using An Empty State. Full Analytics
        Integration Will Be Implemented Soon.
      </StatusBanner>

      {/* ====================== HEADER ====================== */}
      <header className="">
        <h1 className="text-2xl font-bold">Your CareChain Activity</h1>
        <p className="text-sm text-muted-foreground">
          Analytics dashboard - awaiting backend integration
        </p>
      </header>

      {/* ====================== METRIC CARDS ====================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Records Owned" value="—" />
        <MetricCard title="Hospitals Connected" value="—" />
        <MetricCard title="Active Read Grants" value="—" />
        <MetricCard title="Active Write Grants" value="—" />
      </section>

      {/* ====================== CHARTS ====================== */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* RECORD HISTORY */}
        <ChartCard
          title="Record Upload History"
          desc="Daily upload activity"
          timeRange={recordRange}
          setTimeRange={setRecordRange}
          type="bar"
          data={emptyBarData}
          config={{
            count: { label: "Records", color: "var(--chart-1)" },
          }}
          extraRanges={["365d", "all"]}
        />

        {/* GRANT BREAKDOWN */}
        <ChartCard
          title="Grant Access Breakdown"
          desc="Read, write, and revoked grants"
          timeRange={grantRange}
          setTimeRange={setGrantRange}
          type="area"
          data={emptyAreaData}
          config={{
            read: { label: "Read Grants", color: "var(--chart-2)" },
            write: { label: "Write Grants", color: "var(--chart-3)" },
            revoked: { label: "Revoked Grants", color: "var(--chart-4)" },
          }}
        />
      </section>
    </main>
  );
}

// =====================================================
// METRIC CARD
// =====================================================

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );
}

// =====================================================
// CHART CARD — EMPTY-STATE SUPPORTED
// =====================================================

function ChartCard({
  title,
  desc,
  timeRange,
  setTimeRange,
  data,
  config,
  type = "bar",
  extraRanges = [],
}: {
  title: string;
  desc: string;
  timeRange: string;
  setTimeRange: (v: string) => void;
  data: any[];
  config: Record<string, { label: string; color: string }>;
  type?: "bar" | "area";
  extraRanges?: string[];
}) {
  return (
    <Card>
      <CardHeader className="flex justify-between border-b py-5">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </div>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[130px] text-xs">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            {extraRanges.includes("365d") && (
              <SelectItem value="365d">Last 365 days</SelectItem>
            )}
            {extraRanges.includes("all") && (
              <SelectItem value="all">All Time</SelectItem>
            )}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {/* Empty state */}
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            No data available yet
          </div>
        ) : type === "bar" ? (
          // BAR CHART (kept intact)
          <ChartContainer
            config={config}
            className="aspect-auto h-[250px] w-full"
          >
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />

              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(val) => val}
                    formatter={(value, name) => [
                      `${value}`,
                      config[name]?.label || name,
                    ]}
                  />
                }
              />

              <Bar
                dataKey="count"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          // AREA CHART (kept intact)
          <ChartContainer
            config={config}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={data}>
              <defs>
                {Object.entries(config).map(([key, c]) => (
                  <linearGradient
                    key={key}
                    id={`fill-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={c.color} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={c.color} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />

              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(val) => val}
                    formatter={(value, name) => [
                      `${value}`,
                      config[name]?.label || name,
                    ]}
                  />
                }
              />

              {Object.entries(config).map(([key, c]) => (
                <Area
                  key={key}
                  dataKey={key}
                  type="natural"
                  fill={`url(#fill-${key})`}
                  stroke={c.color}
                  strokeWidth={2}
                  activeDot={{ r: 3 }}
                />
              ))}

              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
