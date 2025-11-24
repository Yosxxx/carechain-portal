"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen justify-center items-center flex-col max-w-xl min-w-xl mx-auto">
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold">BE APART OF CARECHAIN</h1>
        <p>Web3-secured healthcare for users and hospitals.</p>
      </div>

      <div className="flex w-full gap-x-5 mt-10">
        <Button
          className="flex-1"
          variant={"outline"}
          onClick={() => router.push("/user/overview")}
        >
          BECOME A USER
        </Button>
        <Button
          className="flex-1"
          variant={"outline"}
          onClick={() => router.push("/auth/admin")}
        >
          REGISTER YOUR HOSPITAL
        </Button>
      </div>
    </main>
  );
}
