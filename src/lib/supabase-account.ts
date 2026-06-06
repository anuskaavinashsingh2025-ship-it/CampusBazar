import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

function profileMeta(user: User) {
  const meta = user.user_metadata ?? {};
  return {
    full_name: (meta.full_name ?? meta.name ?? null) as string | null,
    avatar_url: (meta.avatar_url ?? null) as string | null,
  };
}

/** Create a profiles row for the signed-in user when the DB trigger did not. */
export async function ensureProfile(user: User): Promise<void> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return;

  const { full_name, avatar_url } = profileMeta(user);
  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    email: user.email ?? "",
    full_name,
    avatar_url,
  });

  if (error?.code === "23505") return;
  if (error) throw error;
}

export type SellerBootstrap = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

/** Ensure seller_profiles exists before listing inserts (FK). */
export async function ensureSellerProfile(seller: SellerBootstrap): Promise<void> {
  const { data: existing } = await supabase
    .from("seller_profiles")
    .select("user_id")
    .eq("user_id", seller.user_id)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("seller_profiles").insert({
    user_id: seller.user_id,
    display_name: seller.display_name,
    avatar_url: seller.avatar_url,
  });

  if (error?.code === "23505") return;
  if (error) throw error;
}
