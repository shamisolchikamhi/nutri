CREATE TABLE "basket_item_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"basket_item_id" integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "basket_item_recipes" ADD CONSTRAINT "basket_item_recipes_basket_item_id_basket_items_id_fk" FOREIGN KEY ("basket_item_id") REFERENCES "public"."basket_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basket_item_recipes" ADD CONSTRAINT "basket_item_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "basket_item_recipe_unique" ON "basket_item_recipes" USING btree ("basket_item_id","recipe_id");