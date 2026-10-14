/* It's Not Food — puzzle deck.
   Each ingredient list is a representative label for a typical product of that
   kind, not any specific brand. Ingredients are in label order (most to least).
   kind:  "food" if people eat or drink it, "not" if they don't.
   book:  key into BOOKS — shown on the answer screen. */

const BOOKS = {
  food:   { name: "It's Not Food",         cover: "covers/it-s-not-food.jpg",         qr: "qr-food.svg",   url: "https://www.amazon.com/dp/B0H28XN7Z1" },
  beauty: { name: "It's Not Beauty",       cover: "covers/it-s-not-beauty.jpg",       qr: "qr-beauty.svg", url: "https://www.amazon.com/dp/B0H3P2TDX4" },
  clean:  { name: "It's Not Clean",        cover: "covers/it-s-not-clean.jpg",        qr: "qr-clean.svg",  url: "https://www.amazon.com/dp/B0H3TLXQDP" },
  kids:   { name: "It's Not for Kids",     cover: "covers/it-s-not-for-kids.jpg",     qr: "qr-kids.svg",   url: "https://www.amazon.com/dp/B0H7T981KL" },
  home:   { name: "Your Home Is Not Safe", cover: "covers/your-home-is-not-safe.jpg", qr: "qr-home.svg",   url: "https://www.amazon.com/dp/B0H4LTY2FJ" }
};
Object.values(BOOKS).forEach((b) => { b.title = "Ingredient Dictionary: " + b.name; });

// Used when players pick "Mix all books".
const SERIES = { name: "All the books", qr: "qr-all.svg", url: "https://maeserbern-ai.github.io/#books" };

const PUZZLES = [
  {
    answer: "Gummy bears",
    options: ["Car wax", "Gummy bears", "Cough drops", "Vitamin gummies"],
    kind: "food", book: "kids",
    ingredients: ["Corn syrup", "Sugar", "Gelatin", "Dextrose", "Citric acid", "Natural and artificial flavors", "Starch", "Vegetable oil", "Carnauba wax", "Red 40", "Yellow 5", "Blue 1"],
    spotlight: { name: "Carnauba wax", note: "A wax from Brazilian palm leaves. It gives gummies their shine — and it's also a classic ingredient in car wax and shoe polish." }
  },
  {
    answer: "Toothpaste",
    options: ["Cake frosting", "Marshmallow fluff", "Toothpaste", "Hand cream"],
    kind: "not", book: "beauty",
    ingredients: ["Sorbitol", "Water", "Hydrated silica", "Sodium lauryl sulfate", "Flavor", "Sodium phosphate", "Cellulose gum", "Sodium saccharin", "Titanium dioxide", "Sodium fluoride"],
    spotlight: { name: "Sorbitol", note: "A sugar alcohol that keeps the paste moist and sweet. It's the same sweetener found in sugar-free gum and candy." }
  },
  {
    answer: "Dandruff shampoo",
    options: ["Dish soap", "Bubble bath", "Laundry detergent", "Dandruff shampoo"],
    kind: "not", book: "beauty",
    ingredients: ["Water", "Sodium laureth sulfate", "Sodium lauryl sulfate", "Glycol distearate", "Cocamide MEA", "Zinc pyrithione", "Sodium chloride", "Dimethicone", "Fragrance", "Sodium benzoate"],
    spotlight: { name: "Sodium chloride", note: "That's plain table salt. Shampoo makers add it to make the liquid thicker." }
  },
  {
    answer: "Lip balm",
    options: ["Lip balm", "Birthday candle", "Crayon", "Baby oil"],
    kind: "not", book: "beauty",
    ingredients: ["Petrolatum", "Lanolin", "Paraffin", "Mineral oil", "Beeswax", "Camphor", "Menthol", "Fragrance"],
    spotlight: { name: "Lanolin", note: "A waxy grease that comes from sheep's wool. Sheep make it to waterproof their coats." }
  },
  {
    answer: "Individually wrapped cheese slices",
    options: ["Cheddar cheese", "Individually wrapped cheese slices", "Mac & cheese powder", "Cheese dip"],
    kind: "food", book: "food",
    ingredients: ["Milk", "Whey", "Milk protein concentrate", "Milkfat", "Sodium citrate", "Salt", "Calcium phosphate", "Lactic acid", "Sorbic acid", "Apocarotenal (color)", "Annatto (color)", "Enzymes", "Cheese culture"],
    spotlight: { name: "Sodium citrate", note: "An emulsifying salt that makes slices melt perfectly smooth. With all the extras, many are legally labeled \"cheese product,\" not cheese." }
  },
  {
    answer: "Dish soap",
    options: ["Shampoo", "Dish soap", "Hand soap", "Bubble bath"],
    kind: "not", book: "clean",
    ingredients: ["Water", "Sodium lauryl sulfate", "Lauramine oxide", "Sodium chloride", "Alcohol denat.", "PPG-26", "Fragrance", "Methylisothiazolinone", "Colorants"],
    spotlight: { name: "Methylisothiazolinone", note: "A preservative that's a common skin allergen. The EU banned it from leave-on cosmetics, but it still shows up in rinse-off products and cleaners." }
  },
  {
    answer: "Ranch dressing",
    options: ["Mayonnaise", "Hand lotion", "Ranch dressing", "Sour cream dip"],
    kind: "food", book: "food",
    ingredients: ["Soybean oil", "Water", "Egg yolk", "Sugar", "Salt", "Cultured nonfat buttermilk", "Natural flavors", "Spices", "Dried garlic", "Dried onion", "Vinegar", "Xanthan gum", "Monosodium glutamate", "Sorbic acid", "Calcium disodium EDTA"],
    spotlight: { name: "Calcium disodium EDTA", note: "A preservative that grabs onto metals so flavors don't go stale. Doctors use the same compound to treat lead poisoning." }
  },
  {
    answer: "Hand lotion",
    options: ["Ranch dressing", "Mayonnaise", "Sunscreen", "Hand lotion"],
    kind: "not", book: "beauty",
    ingredients: ["Water", "Glycerin", "Mineral oil", "Stearic acid", "Cetyl alcohol", "Glyceryl stearate", "Dimethicone", "Petrolatum", "Fragrance", "Carbomer", "Methylparaben", "Propylparaben"],
    spotlight: { name: "Stearic acid", note: "A fatty acid from plant or animal fat. It's also what makes candles and bar soap hard." }
  },
  {
    answer: "Vanilla frosting",
    options: ["Vanilla frosting", "Shaving cream", "Hand lotion", "Whipped topping"],
    kind: "food", book: "food",
    ingredients: ["Sugar", "Palm oil", "Water", "Corn syrup", "Corn starch", "Salt", "Mono- and diglycerides", "Polysorbate 60", "Natural and artificial flavor", "Sodium stearoyl lactylate", "Citric acid", "Potassium sorbate", "Soy lecithin"],
    spotlight: { name: "Polysorbate 60", note: "An emulsifier that keeps oil and water mixed. You'll find the same family of ingredients in lotions and creams." }
  },
  {
    answer: "Shaving cream",
    options: ["Spray whipped cream", "Frosting", "Shaving cream", "Body lotion"],
    kind: "not", book: "beauty",
    ingredients: ["Water", "Stearic acid", "Triethanolamine", "Laureth-23", "Isobutane", "Propane", "Fragrance", "Sorbitol"],
    spotlight: { name: "Isobutane and propane", note: "The same gases used in camping stoves. In a can, they're what puff the cream into foam." }
  },
  {
    answer: "Spray whipped cream",
    options: ["Shaving cream", "Spray whipped cream", "Hair mousse", "Coffee creamer"],
    kind: "food", book: "food",
    ingredients: ["Cream", "Water", "Sugar", "Corn syrup", "Nonfat milk", "Natural flavor", "Mono- and diglycerides", "Carrageenan", "Nitrous oxide (propellant)"],
    spotlight: { name: "Nitrous oxide", note: "Also known as laughing gas — the same gas a dentist uses. It whips the cream as it leaves the can." }
  },
  {
    answer: "Frozen whipped topping",
    options: ["Real whipped cream", "Hair conditioner", "Shaving cream", "Frozen whipped topping"],
    kind: "food", book: "food",
    ingredients: ["Water", "Hydrogenated vegetable oil (coconut and palm kernel)", "High fructose corn syrup", "Corn syrup", "Skim milk", "Light cream", "Sodium caseinate", "Natural and artificial flavor", "Xanthan and guar gums", "Polysorbate 60", "Sorbitan monostearate", "Beta carotene (color)"],
    spotlight: { name: "Light cream", note: "It's sixth on the list. The tub is mostly water, oil and syrup — cream makes up only a tiny part." }
  },
  {
    answer: "Hair conditioner",
    options: ["Hair conditioner", "Frozen whipped topping", "Shampoo", "Body wash"],
    kind: "not", book: "beauty",
    ingredients: ["Water", "Cetearyl alcohol", "Behentrimonium chloride", "Stearamidopropyl dimethylamine", "Dimethicone", "Glycerin", "Fragrance", "Citric acid", "Benzyl alcohol", "Phenoxyethanol"],
    spotlight: { name: "Cetearyl alcohol", note: "Despite the name, it's not drying like rubbing alcohol. It's a waxy \"fatty alcohol\" from coconut or palm that makes conditioner creamy." }
  },
  {
    answer: "Diet cola",
    options: ["Iced tea", "Root beer", "Rust remover", "Diet cola"],
    kind: "food", book: "food",
    ingredients: ["Carbonated water", "Caramel color", "Aspartame", "Phosphoric acid", "Potassium benzoate", "Natural flavors", "Citric acid", "Caffeine"],
    spotlight: { name: "Phosphoric acid", note: "It gives cola its tang. It's also the main ingredient in many rust removers." }
  },
  {
    answer: "Toilet bowl cleaner",
    options: ["Diet cola", "Glass cleaner", "Toilet bowl cleaner", "Mouthwash"],
    kind: "not", book: "home",
    ingredients: ["Water", "Hydrochloric acid", "Lauramine oxide", "Xanthan gum", "Fragrance", "Colorant"],
    spotlight: { name: "Hydrochloric acid", note: "The same acid your stomach makes to digest food. Never mix it with bleach — together they release toxic gas." }
  },
  {
    answer: "Mouthwash",
    options: ["Sports drink", "Mint liqueur", "Mouthwash", "Glass cleaner"],
    kind: "not", book: "beauty",
    ingredients: ["Water", "Alcohol (21.6%)", "Sorbitol", "Flavor", "Poloxamer 407", "Benzoic acid", "Eucalyptol", "Methyl salicylate", "Thymol", "Menthol", "Sodium benzoate", "Sodium saccharin", "Green 3"],
    spotlight: { name: "Alcohol (21.6%)", note: "That's about 43 proof — stronger than most wine. It's why the classic version burns." }
  },
  {
    answer: "Sports drink",
    options: ["Mouthwash", "Window cleaner", "Sports drink", "Lemonade powder"],
    kind: "food", book: "food",
    ingredients: ["Water", "Sugar", "Dextrose", "Citric acid", "Salt", "Sodium citrate", "Monopotassium phosphate", "Gum arabic", "Glycerol ester of rosin", "Natural flavor", "Yellow 6"],
    spotlight: { name: "Glycerol ester of rosin", note: "Made from pine tree rosin. It keeps the flavor oils from floating to the top of the bottle." }
  },
  {
    answer: "Glass cleaner",
    options: ["Glass cleaner", "Sports drink", "Mouthwash", "Blue raspberry slushie"],
    kind: "not", book: "home",
    ingredients: ["Water", "2-Hexoxyethanol", "Isopropanolamine", "Sodium dodecylbenzene sulfonate", "Ammonium hydroxide", "Fragrance", "Blue dye"],
    spotlight: { name: "Ammonium hydroxide", note: "Ammonia dissolved in water — it's what cuts the streaks. Never mix it with bleach." }
  },
  {
    answer: "Fruity cereal rings",
    options: ["Dog treats", "Fruity cereal rings", "Granola", "Bird seed"],
    kind: "food", book: "kids",
    ingredients: ["Sugar", "Corn flour blend", "Wheat flour", "Whole grain oat flour", "Hydrogenated vegetable oil", "Oat fiber", "Soluble corn fiber", "Salt", "Natural flavor", "Red 40", "Yellow 5", "Blue 1", "Yellow 6", "BHT (for freshness)"],
    spotlight: { name: "BHT", note: "A preservative that stops fats from going rancid. The same antioxidant is also added to rubber, plastics and jet fuel." }
  },
  {
    answer: "Bacon-style dog treats",
    options: ["Beef jerky", "Bacon bits", "Bacon-style dog treats", "Fruit leather"],
    kind: "not", book: "home",
    ingredients: ["Ground wheat", "Corn gluten meal", "Water", "Sugar", "Glycerin", "Soy grits", "Bacon fat (preserved with BHA)", "Salt", "Phosphoric acid", "Sorbic acid", "Calcium propionate", "Natural smoke flavor", "Red 40", "Yellow 5", "Yellow 6", "Blue 1"],
    spotlight: { name: "Red 40", note: "The same dye used in candy. Dogs don't care what color their treats are — the color is there for the humans." }
  },
  {
    answer: "Imitation bacon bits",
    options: ["Croutons", "Fish food flakes", "Bacon-style dog treats", "Imitation bacon bits"],
    kind: "food", book: "food",
    ingredients: ["Defatted soy flour", "Soybean oil", "Salt", "Caramel color", "Natural and artificial flavor", "Yeast extract", "Red 40"],
    spotlight: { name: "Defatted soy flour", note: "There's no bacon in them at all. They're crunchy bits of flavored, colored soy." }
  },
  {
    answer: "Fish food flakes",
    options: ["Fish food flakes", "Bread crumbs", "Fish oil capsules", "Imitation bacon bits"],
    kind: "not", book: "home",
    ingredients: ["Fish meal", "Shrimp meal", "Wheat flour", "Soybean meal", "Fish oil", "Brewers dried yeast", "Spirulina", "Algae meal", "Ascorbic acid", "Ethoxyquin"],
    spotlight: { name: "Ethoxyquin", note: "A preservative first developed to stabilize rubber. The EU suspended it as an animal feed additive in 2017." }
  },
  {
    answer: "Powdered coffee creamer",
    options: ["Powdered milk", "Baby powder", "Powdered coffee creamer", "Pancake mix"],
    kind: "food", book: "food",
    ingredients: ["Corn syrup solids", "Hydrogenated vegetable oil (coconut and/or palm kernel)", "Sodium caseinate", "Mono- and diglycerides", "Dipotassium phosphate", "Sodium aluminosilicate", "Artificial flavor", "Annatto color"],
    spotlight: { name: "Sodium caseinate", note: "A protein made from milk — even though the jar says \"non-dairy.\" Labeling rules allow it." }
  },
  {
    answer: "Baby powder",
    options: ["Cornstarch", "Powdered sugar", "Baby powder", "Dry shampoo"],
    kind: "not", book: "kids",
    ingredients: ["Zea mays (corn) starch", "Tricalcium phosphate", "Fragrance"],
    spotlight: { name: "Zea mays (corn) starch", note: "The same cornstarch in your pantry, under its Latin name. Many brands switched to it from talc." }
  },
  {
    answer: "Dry shampoo",
    options: ["Spray deodorant", "Cooking spray", "Hairspray", "Dry shampoo"],
    kind: "not", book: "beauty",
    ingredients: ["Butane", "Isobutane", "Propane", "Alcohol denat.", "Oryza sativa (rice) starch", "Fragrance", "Isopropyl myristate", "Distearyldimonium chloride", "Silica"],
    spotlight: { name: "Butane, isobutane, propane", note: "The first three ingredients are flammable fuel gases. Let it settle before you go near a curling iron or flame." }
  },
  {
    answer: "Cooking spray",
    options: ["Cooking spray", "Dry shampoo", "Furniture polish", "Hairspray"],
    kind: "food", book: "food",
    ingredients: ["Canola oil", "Soy lecithin", "Dimethyl silicone", "Rosemary extract", "Propellant (butane, propane)"],
    spotlight: { name: "Dimethyl silicone", note: "An anti-foaming silicone — the same family as the dimethicone in hair conditioner and lotion." }
  },
  {
    answer: "Laundry detergent pod",
    options: ["Gummy candy", "Dishwasher tablet", "Laundry detergent pod", "Bath bomb"],
    kind: "not", book: "home",
    ingredients: ["Propylene glycol", "C12-15 pareth-9", "Linear alkylbenzene sulfonate", "Glycerin", "Water", "Ethanolamine", "Citric acid", "Enzymes", "Fragrance", "Polyvinyl alcohol (film)"],
    spotlight: { name: "Polyvinyl alcohol film", note: "The wrapper that dissolves in the wash. Pods look like candy, so keep them locked away from kids." }
  },
  {
    answer: "Bath bomb",
    options: ["Antacid tablet", "Baking powder", "Bath bomb", "Fizzy candy"],
    kind: "not", book: "beauty",
    ingredients: ["Sodium bicarbonate", "Citric acid", "Magnesium sulfate", "Corn starch", "Coconut oil", "Fragrance", "Colorants"],
    spotlight: { name: "Sodium bicarbonate + citric acid", note: "Baking soda plus acid — the same fizz as a science-fair volcano or a fizzy antacid tablet." }
  },
  {
    answer: "Baking powder",
    options: ["Bath bomb", "Antacid tablet", "Laundry booster", "Baking powder"],
    kind: "food", book: "food",
    ingredients: ["Sodium bicarbonate", "Sodium aluminum sulfate", "Corn starch", "Monocalcium phosphate"],
    spotlight: { name: "Sodium aluminum sulfate", note: "The second-stage acid that makes \"double-acting\" powder rise again in the oven. Aluminum-free versions exist." }
  },
  {
    answer: "Instant ramen seasoning packet",
    options: ["Instant ramen seasoning packet", "Bouillon cube", "Taco seasoning", "Bath salts"],
    kind: "food", book: "food",
    ingredients: ["Salt", "Monosodium glutamate", "Sugar", "Hydrolyzed soy protein", "Garlic powder", "Onion powder", "Spices", "Disodium inosinate", "Disodium guanylate", "Caramel color"],
    spotlight: { name: "Disodium inosinate & guanylate", note: "Flavor boosters that make MSG taste many times stronger. They're often made from yeast or fish." }
  },
  {
    answer: "Bath salts",
    options: ["Sea salt", "Instant ramen seasoning packet", "Road salt", "Bath salts"],
    kind: "not", book: "beauty",
    ingredients: ["Magnesium sulfate", "Sodium chloride", "Fragrance", "Mica", "Colorants"],
    spotlight: { name: "Magnesium sulfate", note: "Better known as Epsom salt. It's also sold as a laxative and as garden fertilizer." }
  },
  {
    answer: "Energy drink",
    options: ["Multivitamin", "Energy drink", "Sports drink", "Cough syrup"],
    kind: "food", book: "food",
    ingredients: ["Carbonated water", "Sucrose", "Glucose", "Citric acid", "Natural flavors", "Taurine", "Sodium citrate", "Panax ginseng extract", "Caffeine", "Sorbic acid", "Niacinamide", "Sucralose", "Inositol", "Guarana extract", "Pyridoxine hydrochloride", "Cyanocobalamin"],
    spotlight: { name: "Taurine", note: "Named after bulls (Latin taurus) because it was first found in ox bile. Today it's made in a lab." }
  },
  {
    answer: "Cough syrup",
    options: ["Fruit punch", "Mouthwash", "Energy drink", "Cough syrup"],
    kind: "not", book: "kids",
    ingredients: ["Water", "High fructose corn syrup", "Glycerin", "Propylene glycol", "Sorbitol", "Dextromethorphan HBr", "Citric acid", "Sodium benzoate", "Flavor", "Red 40"],
    spotlight: { name: "Propylene glycol", note: "It keeps the syrup smooth. It's also the base of \"pet-safer\" antifreeze." }
  },
  {
    answer: "Chewing gum",
    options: ["Rubber cement", "Chewing gum", "Mint candies", "Lip balm"],
    kind: "food", book: "kids",
    ingredients: ["Sugar", "Gum base", "Corn syrup", "Dextrose", "Glycerol", "Natural and artificial flavors", "Soy lecithin", "Yellow 5 Lake", "BHT"],
    spotlight: { name: "Gum base", note: "A secret blend that can include synthetic rubber and polyvinyl acetate — a plastic also used in white wood glue." }
  },
  {
    answer: "Diaper rash cream",
    options: ["Sunscreen", "Cream cheese", "Diaper rash cream", "Vanilla frosting"],
    kind: "not", book: "kids",
    ingredients: ["Zinc oxide (40%)", "Petrolatum", "Cod liver oil", "Lanolin", "Talc", "Water", "Fragrance", "Methylparaben", "BHA"],
    spotlight: { name: "Cod liver oil", note: "Yes, fish oil — in a baby cream. It's there to soothe skin." }
  },
  {
    answer: "Hot dogs",
    options: ["Canned dog food", "Hot dogs", "Chicken nuggets", "Canned meat loaf"],
    kind: "food", book: "food",
    ingredients: ["Mechanically separated chicken", "Pork", "Water", "Corn syrup", "Salt", "Potassium lactate", "Sodium phosphates", "Flavorings", "Sodium diacetate", "Sodium erythorbate", "Sodium nitrite", "Extractives of paprika"],
    spotlight: { name: "Mechanically separated chicken", note: "A meat paste made by pressing chicken bones through a sieve under high pressure." }
  },
  {
    answer: "Canned dog food",
    options: ["Hot dogs", "Beef stew", "Canned dog food", "Liver pâté"],
    kind: "not", book: "home",
    ingredients: ["Water sufficient for processing", "Meat by-products", "Chicken", "Liver", "Wheat gluten", "Corn starch", "Guar gum", "Salt", "Potassium chloride", "Caramel color", "Vitamins and minerals"],
    spotlight: { name: "Water sufficient for processing", note: "Pet food labels list water first when it's the biggest ingredient — the can is mostly water." }
  },
  {
    answer: "Ketchup",
    options: ["Barbecue sauce", "Pizza sauce", "Ketchup", "Red food coloring"],
    kind: "food", book: "food",
    ingredients: ["Tomato concentrate", "Distilled vinegar", "High fructose corn syrup", "Corn syrup", "Salt", "Spice", "Onion powder", "Natural flavoring"],
    spotlight: { name: "Two corn syrups", note: "A common label trick: splitting the sweetener into two kinds pushes each one lower on the list." }
  },
  {
    answer: "Hand sanitizer",
    options: ["Aloe vera gel", "Hair gel", "Hand sanitizer", "Mouthwash"],
    kind: "not", book: "clean",
    ingredients: ["Ethyl alcohol (70%)", "Water", "Glycerin", "Propylene glycol", "Fragrance", "Isopropyl myristate", "Tocopheryl acetate", "Aloe barbadensis leaf juice", "Carbomer", "Aminomethyl propanol"],
    spotlight: { name: "Ethyl alcohol", note: "The same alcohol found in drinks — denatured with bitter additives so nobody drinks it." }
  },
  {
    answer: "Hair gel",
    options: ["Grape jelly", "Hand sanitizer", "Hair gel", "Aloe vera gel"],
    kind: "not", book: "beauty",
    ingredients: ["Water", "PVP", "Triethanolamine", "Carbomer", "Polysorbate 20", "Glycerin", "Fragrance", "Methylparaben"],
    spotlight: { name: "PVP (polyvinylpyrrolidone)", note: "The hold in hair gel. It was used during World War II as a blood plasma substitute." }
  },
  {
    answer: "Grape jelly",
    options: ["Grape juice", "Hair gel", "Cough syrup", "Grape jelly"],
    kind: "food", book: "food",
    ingredients: ["Grape juice", "High fructose corn syrup", "Corn syrup", "Fruit pectin", "Citric acid", "Sodium citrate"],
    spotlight: { name: "Fruit pectin", note: "A natural gelling fiber from apple peels and citrus rinds. It's what turns juice into jelly." }
  },

  /* ---------- more for It's Not Clean ---------- */
  {
    answer: "Liquid bleach",
    options: ["Contact lens solution", "Liquid bleach", "Salt water", "Glass cleaner"],
    kind: "not", book: "clean",
    ingredients: ["Water", "Sodium hypochlorite", "Sodium chloride", "Sodium hydroxide", "Sodium carbonate", "Sodium chlorate", "Sodium polyacrylate"],
    spotlight: { name: "Sodium hydroxide", note: "Also called lye. It's the same chemical used to make soap — and to give soft pretzels their shiny brown crust." }
  },
  {
    answer: "Liquid laundry detergent",
    options: ["Dish soap", "Fabric softener", "Liquid laundry detergent", "Shampoo"],
    kind: "not", book: "clean",
    ingredients: ["Water", "Sodium laureth sulfate", "C12-15 pareth-7", "Sodium citrate", "Propylene glycol", "Linear alkylbenzene sulfonate", "Enzymes (protease, amylase)", "Optical brightener", "Fragrance", "Colorant"],
    spotlight: { name: "Optical brightener", note: "A dye that glows blue under UV light so white clothes look whiter. It doesn't clean anything — it just changes how fabric reflects light." }
  },
  {
    answer: "Fabric softener",
    options: ["Hair conditioner", "Fabric softener", "Hand lotion", "Liquid laundry detergent"],
    kind: "not", book: "clean",
    ingredients: ["Water", "Diethylester dimethyl ammonium chloride", "Fragrance", "Calcium chloride", "Formic acid", "Silicone", "Dye"],
    spotlight: { name: "Formic acid", note: "The same acid in ant stings. Its name comes from formica, Latin for ant." }
  },
  {
    answer: "Dishwasher detergent powder",
    options: ["Bath salts", "Baking powder", "Powdered drink mix", "Dishwasher detergent powder"],
    kind: "not", book: "clean",
    ingredients: ["Sodium carbonate", "Sodium percarbonate", "Sodium citrate", "Sodium silicate", "Enzymes", "Nonionic surfactant", "Fragrance"],
    spotlight: { name: "Sodium percarbonate", note: "Washing soda bonded with hydrogen peroxide. In water it releases oxygen bubbles — the \"oxygen bleach\" in stain removers." }
  },
  {
    answer: "Citrus all-purpose cleaner",
    options: ["Orange soda", "Citrus all-purpose cleaner", "Sports drink", "Air freshener"],
    kind: "not", book: "clean",
    ingredients: ["Water", "Alkyl polyglucoside", "Sodium citrate", "Limonene", "Fragrance", "Methylisothiazolinone"],
    spotlight: { name: "Limonene", note: "The compound that makes oranges smell like oranges. Indoors it can react with ozone in the air and form small amounts of formaldehyde." }
  },
  {
    answer: "Scouring powder",
    options: ["Antacid tablets", "Baby powder", "Scouring powder", "Baking soda"],
    kind: "not", book: "clean",
    ingredients: ["Calcium carbonate", "Sodium carbonate", "Sodium dichloroisocyanurate", "Sodium dodecylbenzene sulfonate", "Fragrance", "Dye"],
    spotlight: { name: "Calcium carbonate", note: "Basically ground-up chalk or limestone — the gritty scrubber. It's also the main ingredient in many antacid tablets." }
  },
  {
    answer: "Liquid hand soap",
    options: ["Liquid hand soap", "Shampoo", "Bubble bath", "Dish soap"],
    kind: "not", book: "clean",
    ingredients: ["Water", "Sodium laureth sulfate", "Cocamidopropyl betaine", "Sodium chloride", "Glycerin", "Fragrance", "Citric acid", "DMDM hydantoin", "Tetrasodium EDTA", "Benzalkonium chloride"],
    spotlight: { name: "DMDM hydantoin", note: "A preservative that works by slowly releasing tiny amounts of formaldehyde." }
  },

  /* ---------- more for It's Not for Kids ---------- */
  {
    answer: "Fruit snacks",
    options: ["Gummy bears", "Fruit leather", "Fruit snacks", "Kids' gummy vitamins"],
    kind: "food", book: "kids",
    ingredients: ["Fruit puree (apple)", "Corn syrup", "Sugar", "Modified corn starch", "Gelatin", "Citric acid", "Lactic acid", "Ascorbic acid", "Natural flavor", "Vitamin A palmitate", "Carnauba wax", "Coconut oil", "Red 40", "Blue 1"],
    spotlight: { name: "Ascorbic acid", note: "That's added vitamin C. It lets the box say \"good source of vitamin C\" even though it's mostly syrup and sugar." }
  },
  {
    answer: "Boxed mac & cheese powder",
    options: ["Cheddar cheese", "Nacho cheese dip", "Cheese puff dust", "Boxed mac & cheese powder"],
    kind: "food", book: "kids",
    ingredients: ["Whey", "Milkfat", "Milk protein concentrate", "Salt", "Sodium triphosphate", "Citric acid", "Lactic acid", "Sodium phosphate", "Calcium phosphate", "Paprika", "Turmeric", "Annatto (color)", "Enzymes", "Cheese culture"],
    spotlight: { name: "Paprika, turmeric and annatto", note: "Where the bright orange comes from. Many brands swapped artificial dyes like Yellow 5 and 6 for spices." }
  },
  {
    answer: "Kids' gummy vitamins",
    options: ["Kids' gummy vitamins", "Fruit snacks", "Cough drops", "Gummy bears"],
    kind: "food", book: "kids",
    ingredients: ["Glucose syrup", "Sugar", "Water", "Gelatin", "Citric acid", "Natural flavors", "Vitamin C", "Vitamin E", "Vitamin A", "Zinc", "Coconut oil", "Carnauba wax", "Black carrot juice (color)"],
    spotlight: { name: "Glucose syrup and sugar", note: "The first two ingredients. They taste like candy, which is exactly why the bottle has a child-proof cap." }
  },
  {
    answer: "Fruit punch juice box",
    options: ["100% apple juice", "Sports drink", "Fruit punch juice box", "Cough syrup"],
    kind: "food", book: "kids",
    ingredients: ["Water", "High fructose corn syrup", "Concentrated juices (pear, grape, apple)", "Citric acid", "Natural flavors", "Ascorbic acid", "Red 40", "Blue 1"],
    spotlight: { name: "Concentrated juices", note: "Third on the list — after water and syrup. Many \"juice drinks\" are only about 10% juice." }
  },

  /* ---------- more for Your Home Is Not Safe ---------- */
  {
    answer: "Drain cleaner gel",
    options: ["Liquid bleach", "Toilet bowl cleaner", "Drain cleaner gel", "Glass cleaner"],
    kind: "not", book: "home",
    ingredients: ["Water", "Sodium hypochlorite", "Sodium hydroxide", "Sodium silicate", "Lauramine oxide", "Sodium xylenesulfonate"],
    spotlight: { name: "Sodium hydroxide", note: "Lye. It clears clogs by turning hair and grease into soap that rinses away. It can burn skin and eyes." }
  },
  {
    answer: "Liquid ant bait",
    options: ["Hummingbird nectar", "Pancake syrup", "Liquid ant bait", "Eye drops"],
    kind: "not", book: "home",
    ingredients: ["Sugar", "Water", "Borax (sodium tetraborate)"],
    spotlight: { name: "Borax", note: "The sweet syrup is bait. Ants carry it home and share it, and the borax slowly works through the colony." }
  },
  {
    answer: "Dryer sheets",
    options: ["Makeup wipes", "Dryer sheets", "Facial tissues", "Coffee filters"],
    kind: "not", book: "home",
    ingredients: ["Polyester sheet", "Fabric softening agents (quaternary ammonium)", "Fatty acid", "Clay", "Fragrance"],
    spotlight: { name: "Polyester sheet", note: "The sheet itself is plastic fabric. It's a carrier that melts softener and fragrance onto your clothes in the heat." }
  },
  {
    answer: "Dry cat food",
    options: ["Breakfast cereal", "Croutons", "Dry cat food", "Bird seed"],
    kind: "not", book: "home",
    ingredients: ["Chicken by-product meal", "Ground yellow corn", "Corn gluten meal", "Animal fat (preserved with mixed tocopherols)", "Brewers rice", "Natural flavor", "Fish meal", "Salt", "Taurine", "Vitamins and minerals"],
    spotlight: { name: "Taurine", note: "Cats can't make enough of it on their own, so it's added — the same ingredient that's in energy drinks." }
  }
];
