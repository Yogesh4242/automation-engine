-- 1. Base Entities (Required for Foreign Keys)
CREATE TABLE public.restaurants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurants_pkey PRIMARY KEY (id)
);

CREATE TABLE public.menu_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  restaurant_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT menu_customers_pkey PRIMARY KEY (id),
  CONSTRAINT fk_menu_customers_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);

-- 2. Automation Core Data
CREATE TABLE public.customer_details (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  restaurant_id uuid,
  Date_of_birth date,
  anniversary_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_details_pkey PRIMARY KEY (id),
  CONSTRAINT customer_details_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.menu_customers(id)
);

-- 3. Configuration Tables
CREATE TABLE public.automatic_campaign_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL UNIQUE,
  enabled boolean DEFAULT false,
  channels text[] DEFAULT ARRAY['email'::text],
  days_before_trigger integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automatic_campaign_settings_pkey PRIMARY KEY (id),
  CONSTRAINT automatic_campaign_settings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);

CREATE TABLE public.automation_triggers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  settings_id uuid NOT NULL UNIQUE,
  new_customer boolean DEFAULT false,
  inactive_customer boolean DEFAULT false,
  repeat_purchase boolean DEFAULT false,
  birthday boolean DEFAULT false,
  anniversary boolean DEFAULT false,
  holiday boolean DEFAULT false,
  vip_customer boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT automation_triggers_pkey PRIMARY KEY (id),
  CONSTRAINT automation_triggers_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.automatic_campaign_settings(id)
);

-- 4. State & Logging
CREATE TABLE public.automation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  trigger_type_id text NOT NULL,
  restaurant_id uuid NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'sent'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb,
  CONSTRAINT automation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT automation_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer_details(id),
  CONSTRAINT automation_logs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
