"use server";

import { hash } from "@node-rs/argon2";
import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export type SignupState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
};

// argon2id params — reasonable defaults for an interactive login.
const ARGON_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        name: flat.fieldErrors.name?.[0],
        email: flat.fieldErrors.email?.[0],
        password: flat.fieldErrors.password?.[0],
      },
    };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Don't leak whether it's a password or OAuth account.
    return {
      ok: false,
      fieldErrors: { email: "An account with this email already exists." },
    };
  }

  const passwordHash = await hash(password, ARGON_OPTS);

  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "MEMBER",
      status: "PENDING",
    },
  });

  return { ok: true };
}

export type LoginState = { error?: string };

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? "")
        .toLowerCase()
        .trim(),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Incorrect email or password." };
    }
    // redirect() throws a control-flow error that must propagate.
    throw err;
  }
}
