import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yeouatwoanncfgjgqhyi.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inllb3VhdHdvYW5uY2ZnamdxaHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NjA5MjIsImV4cCI6MjA2OTUzNjkyMn0.c0LjLHq-ZCYiZsAAeSs0E9oJmBHNkoertswGsdLA4Fo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
