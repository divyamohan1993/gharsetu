import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{8,15}$/, "Invalid phone")
  .optional();

export const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  role: z.enum(["student", "owner"]),
  preferred_lang: z.enum(["en", "hi"]).optional().default("en"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const listingSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(4000),
  property_type: z.enum(["single_room", "shared_room", "full_pg", "flat"]),
  gender_pref: z.enum(["male", "female", "any"]).default("any"),
  rent_monthly: z.coerce.number().int().positive().max(1_000_000),
  deposit: z.coerce.number().int().nonnegative().max(10_000_000).default(0),
  address_line: z.string().trim().min(5).max(255),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^[0-9]{6}$/),
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  near_landmark: z.string().trim().max(160).optional().or(z.literal("")),
  amenities: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
  rules: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  available_from: z.coerce.number().int().nonnegative(),
});

export const bookingSchema = z.object({
  listing_id: z.string().min(10),
  type: z.enum(["visit", "reserve"]),
  visit_at: z.coerce.number().int().positive().optional(),
  message: z.string().trim().max(500).optional(),
});

export const feedbackSchema = z.object({
  rating: z.coerce.number().int().gte(1).lte(5),
  body: z.string().trim().min(10).max(2000),
});

export const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  min: z.coerce.number().int().nonnegative().optional(),
  max: z.coerce.number().int().nonnegative().optional(),
  type: z.enum(["single_room", "shared_room", "full_pg", "flat"]).optional(),
  gender: z.enum(["male", "female", "any"]).optional(),
  amenities: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v ? v.split(",") : []))
    .optional(),
  sort: z.enum(["recent", "price_asc", "price_desc"]).optional().default("recent"),
  page: z.coerce.number().int().positive().optional().default(1),
  near_lat: z.coerce.number().gte(-90).lte(90).optional(),
  near_lng: z.coerce.number().gte(-180).lte(180).optional(),
});
