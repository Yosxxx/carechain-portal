"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

import { AreaChart, Area, CartesianGrid, XAxis, BarChart, Bar } from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { StatusBanner } from "@/components/status-banner";

export default function Page() {
  const [recordRange, setRecordRange] = React.useState("30d");
  const [grantRange, setGrantRange] = React.useState("30d");

  // Completely empty — no mock data
  // const records: any[] = [];
  // const grants: any[] = [];

  // Derived empty datasets
  const recordChartData: any[] = [];
  const grantChartData: any[] = [];

  return (
    <main className="space-y-8 mb-5">
      <StatusBanner type="warning">
        ⚠️ This Page Is Currently Using An Empty State. Full Analytics
        Integration Will Be Implemented Soon.
      </StatusBanner>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Hospital Overview</h1>
        <p className="text-sm text-muted-foreground">
          Analytics dashboard — awaiting real on-chain + off-chain data
          integration.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Records Uploaded" value={0} />
        <MetricCard title="Unique Patients Served" value={0} />
        <MetricCard title="Active Write Grants" value={0} />
        <MetricCard title="Total Grants" value={0} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartCard
          title="Record Uploads per Day"
          desc="No record activity available"
          timeRange={recordRange}
          setTimeRange={setRecordRange}
          data={recordChartData}
          chartType="bar"
          strokeColor="var(--chart-1)"
        />

        <ChartCard
          title="Grant Activity Overview"
          desc="No grant activity available"
          timeRange={grantRange}
          setTimeRange={setGrantRange}
          data={grantChartData}
          multiSeries={[
            {
              key: "writeTotal",
              label: "Write Grants",
              color: "var(--chart-2)",
            },
            { key: "readTotal", label: "Read Grants", color: "var(--chart-3)" },
            {
              key: "totalActive",
              label: "Total Active",
              color: "var(--chart-1)",
            },
          ]}
        />
      </section>
    </main>
  );
}

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

function ChartCard({
  title,
  desc,
  data,
  dataKey,
  strokeColor,
  multiSeries,
  timeRange,
  setTimeRange,
  chartType = "area",
}: {
  title: string;
  desc: string;
  data: any[];
  dataKey?: string;
  strokeColor?: string;
  multiSeries?: { key: string; label: string; color: string }[];
  timeRange: string;
  setTimeRange: (v: string) => void;
  chartType?: "area" | "bar";
}) {
  const chartConfig = multiSeries
    ? multiSeries.reduce((acc, s) => {
        acc[s.key] = { label: s.label, color: s.color };
        return acc;
      }, {} as any)
    : { [dataKey ?? "value"]: { label: title, color: strokeColor } };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b py-5">
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
            <SelectItem value="365d">Last 365 days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
            No data available
          </div>
        ) : chartType === "bar" ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(l) => l}
                    formatter={(v, n) => [`${v}`, chartConfig[n]?.label]}
                  />
                }
              />
              <Bar dataKey="count" fill={strokeColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(l) => l}
                    formatter={(v, n) => [`${v}`, chartConfig[n]?.label]}
                  />
                }
              />
              {multiSeries?.map((s) => (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.1}
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
