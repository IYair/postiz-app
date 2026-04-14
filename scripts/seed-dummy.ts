/**
 * Seed dummy channels + posts for local responsive QA.
 * Run: pnpm dlx tsx scripts/seed-dummy.ts
 *
 * Inserts 5 integrations (X, LinkedIn, Instagram, Facebook, YouTube) and
 * 10 posts distributed across the current ISO week at varied hours.
 * Idempotent: skips integrations that already exist by internalId.
 */

import { PrismaClient, State } from '@prisma/client';

const prisma = new PrismaClient();

const CHANNELS: Array<{
  providerIdentifier: string;
  name: string;
  picture: string;
  type: 'social';
}> = [
  { providerIdentifier: 'x', name: 'Demo X Account', picture: '/no-picture.jpg', type: 'social' },
  { providerIdentifier: 'linkedin', name: 'Demo LinkedIn', picture: '/no-picture.jpg', type: 'social' },
  { providerIdentifier: 'instagram', name: 'Demo Instagram', picture: '/no-picture.jpg', type: 'social' },
  { providerIdentifier: 'facebook', name: 'Demo Facebook Page', picture: '/no-picture.jpg', type: 'social' },
  { providerIdentifier: 'youtube', name: 'Demo YouTube', picture: '/no-picture.jpg', type: 'social' },
];

const POST_TEMPLATES = [
  'Launching a new feature today — super excited to share this with our community! 🎉',
  'Behind the scenes of our latest product shoot. Stay tuned for the full reveal.',
  'Throwback to our team offsite in the mountains. Incredible energy and ideas.',
  'Industry tip of the day: measure twice, ship once. Consistency compounds.',
  'We are hiring! Open roles in engineering and design. DM to apply.',
  'Customer spotlight: how @Acme scaled 3x after switching to our platform.',
  'Weekend reading list for makers and founders. Saved links in the comments.',
  'Quick demo of the new dashboard — drag, drop, done.',
  'Answer to the #1 question we got this week: yes, it works offline.',
  'Year in review — the milestones, the misses, and what is next.',
];

async function main() {
  // Pick the most recently active user (the one who just logged in).
  const user = await prisma.user.findFirst({
    orderBy: { lastOnline: 'desc' },
    include: { organizations: { include: { organization: true } } },
  });

  if (!user) {
    console.error('No users found. Register at http://localhost:4200 first, then re-run this script.');
    process.exit(1);
  }

  let orgId = user.organizations[0]?.organizationId;
  if (!orgId) {
    const org = await prisma.organization.create({
      data: { name: `${user.name || 'Demo'} Org`, users: { create: { userId: user.id, role: 'SUPERADMIN' } } },
    });
    orgId = org.id;
  }
  console.log(`Seeding for user ${user.email} (org ${orgId})`);

  // Insert channels (skip existing by internalId).
  const created: { id: string; providerIdentifier: string; name: string }[] = [];
  for (const c of CHANNELS) {
    const internalId = `dummy-${c.providerIdentifier}`;
    const existing = await prisma.integration.findUnique({
      where: { organizationId_internalId: { organizationId: orgId, internalId } },
    });
    if (existing) {
      created.push({ id: existing.id, providerIdentifier: c.providerIdentifier, name: c.name });
      console.log(`  · ${c.providerIdentifier} already present`);
      continue;
    }
    const integration = await prisma.integration.create({
      data: {
        internalId,
        organizationId: orgId,
        name: c.name,
        picture: c.picture,
        providerIdentifier: c.providerIdentifier,
        type: c.type,
        token: 'dummy-token',
        profile: `demo_${c.providerIdentifier}`,
      },
    });
    created.push({ id: integration.id, providerIdentifier: c.providerIdentifier, name: c.name });
    console.log(`  ✓ Created ${c.providerIdentifier}`);
  }

  // Build 10 posts spread Mon–Sun of current week at varied hours.
  const now = new Date();
  const monday = new Date(now);
  const daysFromMon = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysFromMon);
  monday.setHours(0, 0, 0, 0);

  const posts = POST_TEMPLATES.map((text, i) => {
    const day = i % 7;
    const hourSlot = [9, 11, 14, 16, 18, 20][i % 6];
    const minute = (i * 13) % 60;
    const d = new Date(monday);
    d.setDate(d.getDate() + day);
    d.setHours(hourSlot, minute, 0, 0);
    const channel = created[i % created.length];
    return {
      content: text,
      publishDate: d,
      integrationId: channel.id,
      group: `demo-group-${i}`,
      state: i % 4 === 0 ? ('DRAFT' as State) : ('QUEUE' as State),
    };
  });

  for (const p of posts) {
    const existing = await prisma.post.findFirst({
      where: { organizationId: orgId, group: p.group },
    });
    if (existing) continue;
    await prisma.post.create({
      data: {
        content: p.content,
        publishDate: p.publishDate,
        organizationId: orgId,
        integrationId: p.integrationId,
        group: p.group,
        state: p.state,
      },
    });
  }
  console.log(`  ✓ Ensured ${posts.length} posts for the current week`);

  await prisma.$disconnect();
  console.log('\nDone. Reload http://localhost:4200/launches to see the data.');
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
