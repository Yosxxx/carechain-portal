/* eslint-disable react/jsx-no-comment-textnodes */
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AdminLoginPassword } from "@/action/AdminLogin";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { StatusBanner } from "@/components/status-banner";

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      setLoading(true);
      setErr("");
      await AdminLoginPassword(formData);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error);
        setErr(error.message || "Login failed.");
      } else {
        setErr("Login failed.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="min-w-md max-w-md font-bold">
        <div className="p-5 border text-xl">// ADMIN LOGIN</div>

        <div className="flex flex-col gap-y-5 p-5 border-b border-l border-r">
          <div>
            <Label htmlFor="email" className="mb-2 font-bold">
              EMAIL ADDRESS
            </Label>
            <Input
              name="email"
              type="email"
              id="email"
              className="font-inter font-normal"
            />
          </div>

          <div>
            <Label htmlFor="password" className="mb-2 font-bold">
              Password
            </Label>
            <Input
              name="password"
              type="password"
              id="password"
              className="font-inter font-normal"
            />
          </div>

          {/* ❌ Error Banner */}
          {err && <StatusBanner type="error">❌ {err}</StatusBanner>}

          <div className="flex flex-col gap-y-5">
            <Button
              className="font-bold hover:cursor-pointer"
              type="submit"
              disabled={loading}
              variant={"outline"}
            >
              {loading ? (
                <>
                  <Spinner />
                  Logging in...
                </>
              ) : (
                <>Login</>
              )}
            </Button>
          </div>

          <div className="font-inter text-sm text-muted-foreground font-normal">
            Want to become apart of CareChain?{" "}
            <Link
              href={"#"}
              className="text-white font-bold hover:cursor-pointer"
            >
              Register.
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
