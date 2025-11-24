/* eslint-disable react/jsx-no-comment-textnodes */
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AdminLoginPassword } from "@/action/AdminLogin";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { StatusBanner } from "@/components/status-banner";

import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [contactOpen, setContactOpen] = useState(false);

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
    <div className="flex min-h-screen items-center justify-center px-4 flex-col">
      {/* BACK BUTTON LEFT */}
      <div className="w-full max-w-md mb-4">
        <Button
          type="button"
          variant="outline"
          className="font-bold"
          onClick={() => window.history.back()}
        >
          Back
        </Button>
      </div>

      {/* LOGIN FORM */}
      <form
        onSubmit={handleSubmit}
        className="min-w-md max-w-md w-full border rounded-xs overflow-hidden bg-card"
      >
        {/* HEADER */}
        <div className="p-5 border-b text-xl font-bold">// ADMIN LOGIN</div>

        {/* BODY */}
        <div className="flex flex-col gap-y-5 p-5">
          <div>
            <Label htmlFor="email" className="font-bold">
              EMAIL ADDRESS
            </Label>
            <Input
              name="email"
              type="email"
              id="email"
              className="font-inter font-normal mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="font-bold">
              PASSWORD
            </Label>
            <Input
              name="password"
              type="password"
              id="password"
              className="font-inter font-normal mt-1"
              required
            />
          </div>

          {/* ERROR MESSAGE */}
          {err && <StatusBanner type="error">❌ {err}</StatusBanner>}

          {/* LOGIN BUTTON */}
          <Button
            className="font-bold mt-2"
            type="submit"
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <>
                <Spinner />
                &nbsp;Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>

          {/* CONTACT LINK */}
          <div className="font-inter text-sm text-muted-foreground">
            Want to become apart of CareChain?{" "}
            <Button
              variant="ghost"
              type="button"
              onClick={() => setContactOpen(true)}
              className="text-white font-bold underline mx-1"
            >
              Contact us.
            </Button>
          </div>
        </div>
      </form>

      {/* CONTACT DIALOG */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Us</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Email: <span className="font-mono">carechain.dev@gmail.com</span>
            <br />
            Phone: XXXX-XXXX-XXXX
            <br />
            Location: XXXX
          </p>

          <div className="mt-4 space-y-3">
            <Label>Your Email</Label>
            <Input placeholder="your@email.com" />

            <Label>Your Message</Label>
            <Textarea placeholder="Write your message..." />
          </div>

          <DialogFooter className="mt-4">
            <Button onClick={() => setContactOpen(false)} variant="outline">
              Close
            </Button>
            <Button disabled variant="secondary">
              Send (coming soon)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
