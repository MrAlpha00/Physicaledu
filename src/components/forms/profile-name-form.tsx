"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileName } from "@/app/(student)/profile/actions";
import { profileNameSchema } from "@/lib/validations/admin";
import type { ActionState } from "@/types/domain";

type Values = { fullName: string };

export function ProfileNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [result, setResult] = useState<ActionState | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { fullName: initialName },
  });

  async function onSubmit(values: Values) {
    const response = await updateProfileName(values);
    setResult(response);
    if (response.status === "success") router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {result ? (
        <p
          role="status"
          className={`border-l-4 p-3 text-sm ${
            result.status === "success"
              ? "border-l-lime bg-lime/15 text-[#33521b]"
              : "border-l-coral bg-coral/10 text-[#8b3725]"
          }`}
        >
          {result.message}
        </p>
      ) : null}
      <div>
        <Label htmlFor="profile-name">Full name</Label>
        <Input id="profile-name" className="mt-2" {...register("fullName")} />
        {errors.fullName ? (
          <p className="mt-1.5 text-xs font-semibold text-coral-dark">{errors.fullName.message}</p>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-ink-muted">
        Only your display name can be changed here. USN, department and verification
        status are controlled by the PE office.
      </p>
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
