-- These functions are only callable by trusted server functions after provider verification.
create function public.credit_verified_payment(p_reference text)
returns boolean language plpgsql security definer set search_path = public as $$
declare payment_row public.payments%rowtype;
begin
  select * into payment_row from public.payments where reference = p_reference for update;
  if not found then raise exception 'Payment not found'; end if;
  if payment_row.status = 'success' then return false; end if;
  insert into public.wallets (user_id, balance_naira) values (payment_row.user_id, payment_row.amount_naira)
  on conflict (user_id) do update set balance_naira = public.wallets.balance_naira + excluded.balance_naira, updated_at = now();
  insert into public.transactions (id, user_id, type, amount_naira, reference, status)
  values (p_reference, payment_row.user_id, 'credit', payment_row.amount_naira, p_reference, 'success');
  update public.payments set status = 'success', credited_at = now() where reference = p_reference;
  return true;
end;
$$;

create function public.reserve_number_order(p_user_id uuid, p_country_code text, p_service text, p_tier text, p_price_naira bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare order_id uuid;
begin
  if p_price_naira < 500 then raise exception 'Invalid price'; end if;
  update public.wallets set balance_naira = balance_naira - p_price_naira, updated_at = now()
  where user_id = p_user_id and balance_naira >= p_price_naira;
  if not found then raise exception 'Insufficient wallet funds'; end if;
  insert into public.orders (user_id, country_code, service, tier, price_naira, status)
  values (p_user_id, p_country_code, p_service, p_tier, p_price_naira, 'provisioning') returning id into order_id;
  insert into public.transactions (id, user_id, type, amount_naira, reference, status)
  values (order_id::text, p_user_id, 'debit', p_price_naira, order_id::text, 'reserved');
  return order_id;
end;
$$;

create function public.refund_failed_number_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare order_row public.orders%rowtype;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_row.status <> 'provisioning' then return false; end if;

  update public.wallets
  set balance_naira = balance_naira + order_row.price_naira, updated_at = now()
  where user_id = order_row.user_id;

  update public.orders set status = 'provider_failed' where id = p_order_id;
  update public.transactions set status = 'refunded' where id = p_order_id::text;
  insert into public.transactions (id, user_id, type, amount_naira, reference, status)
  values ('refund:' || p_order_id::text, order_row.user_id, 'credit', order_row.price_naira, p_order_id::text, 'success');
  return true;
end;
$$;

revoke all on function public.credit_verified_payment(text) from public, anon, authenticated;
revoke all on function public.reserve_number_order(uuid, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.refund_failed_number_order(uuid) from public, anon, authenticated;
grant execute on function public.credit_verified_payment(text) to service_role;
grant execute on function public.reserve_number_order(uuid, text, text, text, bigint) to service_role;
grant execute on function public.refund_failed_number_order(uuid) to service_role;
