import { PrismaClient, Carrier } from "@prisma/client";

const db = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function skuCode(modelSlug: string, storageGb: number, carrier: Carrier): string {
  const carrierMap: Record<Carrier, string> = {
    UNLOCKED: "unl",
    ATT: "att",
    TMOBILE: "tmo",
    VERIZON: "vzn",
    SPRINT: "spr",
    OTHER: "oth",
  };
  // Shorten model slug for SKU
  const short = modelSlug
    .replace("iphone-", "iph")
    .replace("galaxy-", "gal")
    .replace("pixel-", "pxl")
    .replace("ipad-", "ipad")
    .replace("-pro-max", "pm")
    .replace("-pro", "p")
    .replace("-plus", "pl")
    .replace("-ultra", "u")
    .replace("-mini", "m")
    .replace("-fold", "f")
    .replace("-flip", "fl")
    .replace("-fe", "fe")
    .replace(/-/g, "");
  return `${short.slice(0, 10)}-${storageGb}-${carrierMap[carrier]}`;
}

// ─── Seed Data Definitions ────────────────────────────────────────────────────

const conditions = [
  {
    grade: "A",
    label: "Excellent",
    description: "Like new — no scratches, no dents, fully functional. Original accessories not required.",
    multiplier: 1.0,
    sortOrder: 0,
  },
  {
    grade: "B",
    label: "Good",
    description: "Minor wear — light scratches on screen or body, fully functional. Common condition for used devices.",
    multiplier: 0.75,
    sortOrder: 1,
  },
  {
    grade: "C",
    label: "Fair",
    description: "Visible wear — noticeable scratches, small cracks (not affecting display), fully functional.",
    multiplier: 0.50,
    sortOrder: 2,
  },
  {
    grade: "D",
    label: "Broken",
    description: "Cracked screen, water damage, or other significant damage. Device may still power on.",
    multiplier: 0.15,
    sortOrder: 3,
  },
];

// Carrier variants to generate per model
// iPhones get all 4; Android gets unlocked only (most modern Android ships unlocked)
const iphoneCarriers: Carrier[] = ["UNLOCKED", "ATT", "TMOBILE", "VERIZON"];
const androidCarriers: Carrier[] = ["UNLOCKED"];

interface ModelDef {
  name: string;
  releaseYear: number;
  storageOptions: number[];
  carriers: Carrier[];
}

interface BrandDef {
  name: string;
  slug: string;
  models: ModelDef[];
}

interface CategoryDef {
  name: string;
  slug: string;
  brands: BrandDef[];
}

const catalog: CategoryDef[] = [
  // ─── SMARTPHONES ─────────────────────────────────────────────────────────
  {
    name: "Smartphone",
    slug: "smartphone",
    brands: [
      {
        name: "Apple",
        slug: "apple",
        models: [
          // iPhone 16 series
          { name: "iPhone 16 Pro Max", releaseYear: 2024, storageOptions: [256, 512, 1024], carriers: iphoneCarriers },
          { name: "iPhone 16 Pro", releaseYear: 2024, storageOptions: [128, 256, 512, 1024], carriers: iphoneCarriers },
          { name: "iPhone 16 Plus", releaseYear: 2024, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          { name: "iPhone 16", releaseYear: 2024, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          // iPhone 15 series
          { name: "iPhone 15 Pro Max", releaseYear: 2023, storageOptions: [256, 512, 1024], carriers: iphoneCarriers },
          { name: "iPhone 15 Pro", releaseYear: 2023, storageOptions: [128, 256, 512, 1024], carriers: iphoneCarriers },
          { name: "iPhone 15 Plus", releaseYear: 2023, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          { name: "iPhone 15", releaseYear: 2023, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          // iPhone 14 series
          { name: "iPhone 14 Pro Max", releaseYear: 2022, storageOptions: [128, 256, 512, 1024], carriers: iphoneCarriers },
          { name: "iPhone 14 Pro", releaseYear: 2022, storageOptions: [128, 256, 512, 1024], carriers: iphoneCarriers },
          { name: "iPhone 14 Plus", releaseYear: 2022, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          { name: "iPhone 14", releaseYear: 2022, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          // iPhone 13 series
          { name: "iPhone 13 Pro Max", releaseYear: 2021, storageOptions: [128, 256, 512, 1024], carriers: iphoneCarriers },
          { name: "iPhone 13 Pro", releaseYear: 2021, storageOptions: [128, 256, 512, 1024], carriers: iphoneCarriers },
          { name: "iPhone 13", releaseYear: 2021, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          { name: "iPhone 13 Mini", releaseYear: 2021, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          // iPhone 12 series
          { name: "iPhone 12 Pro Max", releaseYear: 2020, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          { name: "iPhone 12 Pro", releaseYear: 2020, storageOptions: [128, 256, 512], carriers: iphoneCarriers },
          { name: "iPhone 12", releaseYear: 2020, storageOptions: [64, 128, 256], carriers: iphoneCarriers },
          { name: "iPhone 12 Mini", releaseYear: 2020, storageOptions: [64, 128, 256], carriers: iphoneCarriers },
          // iPhone 11 series
          { name: "iPhone 11 Pro Max", releaseYear: 2019, storageOptions: [64, 256, 512], carriers: ["UNLOCKED"] },
          { name: "iPhone 11 Pro", releaseYear: 2019, storageOptions: [64, 256, 512], carriers: ["UNLOCKED"] },
          { name: "iPhone 11", releaseYear: 2019, storageOptions: [64, 128, 256], carriers: ["UNLOCKED"] },
          // SE
          { name: "iPhone SE (3rd Gen)", releaseYear: 2022, storageOptions: [64, 128, 256], carriers: iphoneCarriers },
          { name: "iPhone SE (2nd Gen)", releaseYear: 2020, storageOptions: [64, 128, 256], carriers: ["UNLOCKED"] },
        ],
      },
      {
        name: "Samsung",
        slug: "samsung",
        models: [
          // S25 series
          { name: "Galaxy S25 Ultra", releaseYear: 2025, storageOptions: [256, 512, 1024], carriers: androidCarriers },
          { name: "Galaxy S25 Plus", releaseYear: 2025, storageOptions: [256, 512], carriers: androidCarriers },
          { name: "Galaxy S25", releaseYear: 2025, storageOptions: [128, 256], carriers: androidCarriers },
          // S24 series
          { name: "Galaxy S24 Ultra", releaseYear: 2024, storageOptions: [256, 512, 1024], carriers: androidCarriers },
          { name: "Galaxy S24 Plus", releaseYear: 2024, storageOptions: [256, 512], carriers: androidCarriers },
          { name: "Galaxy S24", releaseYear: 2024, storageOptions: [128, 256], carriers: androidCarriers },
          { name: "Galaxy S24 FE", releaseYear: 2024, storageOptions: [128, 256], carriers: androidCarriers },
          // S23 series
          { name: "Galaxy S23 Ultra", releaseYear: 2023, storageOptions: [256, 512, 1024], carriers: androidCarriers },
          { name: "Galaxy S23 Plus", releaseYear: 2023, storageOptions: [256, 512], carriers: androidCarriers },
          { name: "Galaxy S23", releaseYear: 2023, storageOptions: [128, 256], carriers: androidCarriers },
          // Z Fold / Flip
          { name: "Galaxy Z Fold 6", releaseYear: 2024, storageOptions: [256, 512, 1024], carriers: androidCarriers },
          { name: "Galaxy Z Fold 5", releaseYear: 2023, storageOptions: [256, 512, 1024], carriers: androidCarriers },
          { name: "Galaxy Z Flip 6", releaseYear: 2024, storageOptions: [256, 512], carriers: androidCarriers },
          { name: "Galaxy Z Flip 5", releaseYear: 2023, storageOptions: [256, 512], carriers: androidCarriers },
          // A series (top sellers)
          { name: "Galaxy A55", releaseYear: 2024, storageOptions: [128, 256], carriers: androidCarriers },
          { name: "Galaxy A35", releaseYear: 2024, storageOptions: [128, 256], carriers: androidCarriers },
        ],
      },
      {
        name: "Google",
        slug: "google",
        models: [
          // Pixel 9 series
          { name: "Pixel 9 Pro XL", releaseYear: 2024, storageOptions: [128, 256, 512, 1024], carriers: androidCarriers },
          { name: "Pixel 9 Pro", releaseYear: 2024, storageOptions: [128, 256, 512, 1024], carriers: androidCarriers },
          { name: "Pixel 9 Pro Fold", releaseYear: 2024, storageOptions: [256, 512], carriers: androidCarriers },
          { name: "Pixel 9", releaseYear: 2024, storageOptions: [128, 256], carriers: androidCarriers },
          // Pixel 8 series
          { name: "Pixel 8 Pro", releaseYear: 2023, storageOptions: [128, 256, 512, 1024], carriers: androidCarriers },
          { name: "Pixel 8", releaseYear: 2023, storageOptions: [128, 256], carriers: androidCarriers },
          { name: "Pixel 8a", releaseYear: 2024, storageOptions: [128, 256], carriers: androidCarriers },
          // Pixel 7 series
          { name: "Pixel 7 Pro", releaseYear: 2022, storageOptions: [128, 256, 512], carriers: androidCarriers },
          { name: "Pixel 7", releaseYear: 2022, storageOptions: [128, 256], carriers: androidCarriers },
          { name: "Pixel 7a", releaseYear: 2023, storageOptions: [128], carriers: androidCarriers },
        ],
      },
      {
        name: "OnePlus",
        slug: "oneplus",
        models: [
          { name: "OnePlus 12", releaseYear: 2024, storageOptions: [256, 512], carriers: androidCarriers },
          { name: "OnePlus 12R", releaseYear: 2024, storageOptions: [128, 256], carriers: androidCarriers },
          { name: "OnePlus 11", releaseYear: 2023, storageOptions: [128, 256], carriers: androidCarriers },
          { name: "OnePlus Open", releaseYear: 2023, storageOptions: [512], carriers: androidCarriers },
        ],
      },
      {
        name: "Motorola",
        slug: "motorola",
        models: [
          { name: "Motorola Edge 50 Ultra", releaseYear: 2024, storageOptions: [512], carriers: androidCarriers },
          { name: "Motorola Edge 50 Pro", releaseYear: 2024, storageOptions: [256, 512], carriers: androidCarriers },
          { name: "Motorola Razr 50 Ultra", releaseYear: 2024, storageOptions: [512], carriers: androidCarriers },
          { name: "Motorola Razr 50", releaseYear: 2024, storageOptions: [256], carriers: androidCarriers },
        ],
      },
    ],
  },

  // ─── TABLETS ─────────────────────────────────────────────────────────────
  {
    name: "Tablet",
    slug: "tablet",
    brands: [
      {
        name: "Apple",
        slug: "apple-tablet",
        models: [
          // iPad Pro
          { name: "iPad Pro 13-inch M4", releaseYear: 2024, storageOptions: [256, 512, 1024, 2048], carriers: ["UNLOCKED"] },
          { name: "iPad Pro 11-inch M4", releaseYear: 2024, storageOptions: [256, 512, 1024, 2048], carriers: ["UNLOCKED"] },
          { name: "iPad Pro 12.9-inch M2", releaseYear: 2022, storageOptions: [128, 256, 512, 1024, 2048], carriers: ["UNLOCKED"] },
          { name: "iPad Pro 11-inch M2", releaseYear: 2022, storageOptions: [128, 256, 512, 1024, 2048], carriers: ["UNLOCKED"] },
          // iPad Air
          { name: "iPad Air 13-inch M2", releaseYear: 2024, storageOptions: [128, 256, 512, 1024], carriers: ["UNLOCKED"] },
          { name: "iPad Air 11-inch M2", releaseYear: 2024, storageOptions: [128, 256, 512, 1024], carriers: ["UNLOCKED"] },
          // iPad
          { name: "iPad (10th Gen)", releaseYear: 2022, storageOptions: [64, 256], carriers: ["UNLOCKED"] },
          { name: "iPad (9th Gen)", releaseYear: 2021, storageOptions: [64, 256], carriers: ["UNLOCKED"] },
          // iPad Mini
          { name: "iPad Mini (6th Gen)", releaseYear: 2021, storageOptions: [64, 256], carriers: ["UNLOCKED"] },
        ],
      },
      {
        name: "Samsung",
        slug: "samsung-tablet",
        models: [
          { name: "Galaxy Tab S9 Ultra", releaseYear: 2023, storageOptions: [256, 512, 1024], carriers: ["UNLOCKED"] },
          { name: "Galaxy Tab S9 Plus", releaseYear: 2023, storageOptions: [256, 512], carriers: ["UNLOCKED"] },
          { name: "Galaxy Tab S9", releaseYear: 2023, storageOptions: [128, 256], carriers: ["UNLOCKED"] },
          { name: "Galaxy Tab S9 FE", releaseYear: 2023, storageOptions: [128, 256], carriers: ["UNLOCKED"] },
          { name: "Galaxy Tab S8 Ultra", releaseYear: 2022, storageOptions: [128, 256, 512], carriers: ["UNLOCKED"] },
        ],
      },
    ],
  },

  // ─── LAPTOPS ─────────────────────────────────────────────────────────────
  {
    name: "Laptop",
    slug: "laptop",
    brands: [
      {
        name: "Apple",
        slug: "apple-laptop",
        models: [
          { name: "MacBook Pro 16-inch M4 Pro", releaseYear: 2024, storageOptions: [512, 1024], carriers: ["UNLOCKED"] },
          { name: "MacBook Pro 14-inch M4 Pro", releaseYear: 2024, storageOptions: [512, 1024], carriers: ["UNLOCKED"] },
          { name: "MacBook Pro 16-inch M3 Pro", releaseYear: 2023, storageOptions: [512, 1024], carriers: ["UNLOCKED"] },
          { name: "MacBook Pro 14-inch M3 Pro", releaseYear: 2023, storageOptions: [512, 1024], carriers: ["UNLOCKED"] },
          { name: "MacBook Air 15-inch M3", releaseYear: 2024, storageOptions: [256, 512, 1024, 2048], carriers: ["UNLOCKED"] },
          { name: "MacBook Air 13-inch M3", releaseYear: 2024, storageOptions: [256, 512, 1024, 2048], carriers: ["UNLOCKED"] },
          { name: "MacBook Air 15-inch M2", releaseYear: 2023, storageOptions: [256, 512, 1024, 2048], carriers: ["UNLOCKED"] },
          { name: "MacBook Air 13-inch M2", releaseYear: 2022, storageOptions: [256, 512, 1024, 2048], carriers: ["UNLOCKED"] },
        ],
      },
    ],
  },
];

// ─── Main Seed Function ───────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting database seed...\n");

  // 1. Conditions
  console.log("Creating device conditions...");
  for (const condition of conditions) {
    await db.deviceCondition.upsert({
      where: { grade: condition.grade },
      update: condition,
      create: condition,
    });
  }
  console.log(`  ✓ ${conditions.length} conditions created\n`);

  // 2. Device catalog
  let totalModels = 0;
  let totalVariants = 0;

  for (const category of catalog) {
    console.log(`Processing category: ${category.name}`);

    const cat = await db.deviceCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: { name: category.name, slug: category.slug },
    });

    for (const brand of category.brands) {
      const br = await db.deviceBrand.upsert({
        where: { slug: brand.slug },
        update: { name: brand.name, categoryId: cat.id },
        create: { name: brand.name, slug: brand.slug, categoryId: cat.id },
      });

      for (let i = 0; i < brand.models.length; i++) {
        const modelDef = brand.models[i];
        const modelSlug = slugify(modelDef.name);

        const model = await db.deviceModel.upsert({
          where: { slug: modelSlug },
          update: {
            name: modelDef.name,
            releaseYear: modelDef.releaseYear,
            brandId: br.id,
            sortOrder: brand.models.length - i, // Newest first
          },
          create: {
            name: modelDef.name,
            slug: modelSlug,
            releaseYear: modelDef.releaseYear,
            brandId: br.id,
            sortOrder: brand.models.length - i,
          },
        });

        totalModels++;

        // Create variants: each storageOption × each carrier
        for (const storageGb of modelDef.storageOptions) {
          for (const carrier of modelDef.carriers) {
            const sku = skuCode(modelSlug, storageGb, carrier);

            await db.deviceVariant.upsert({
              where: { skuCode: sku },
              update: { storageGb, carrier, modelId: model.id },
              create: {
                modelId: model.id,
                storageGb,
                carrier,
                skuCode: sku,
              },
            });

            totalVariants++;
          }
        }
      }

      console.log(`  ✓ ${brand.name}: ${brand.models.length} models`);
    }

    console.log("");
  }

  console.log(`✅ Catalog seeded:`);
  console.log(`   ${catalog.length} categories`);
  console.log(`   ${totalModels} models`);
  console.log(`   ${totalVariants} variants\n`);

  // 3. Optional: Create a default platform admin user
  // Uncomment and set your email to create your admin account on first seed
  /*
  const adminEmail = "admin@buybacksite.com";
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await db.user.create({
      data: {
        email: adminEmail,
        name: "Platform Admin",
        role: "PLATFORM_ADMIN",
      },
    });
    console.log(`✅ Platform admin created: ${adminEmail}`);
  }
  */

  console.log("🌱 Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
