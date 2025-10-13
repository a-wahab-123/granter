import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-16 md:py-24">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-16">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          granter
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8">
          Composable, type-safe authorization for TypeScript
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/docs"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/seeden/granter"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 rounded-lg font-medium transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16 max-w-6xl mx-auto">
        <FeatureCard
          icon="✨"
          title="Composable"
          description="Build complex permissions from simple rules with or, and, not operators"
        />
        <FeatureCard
          icon="🔒"
          title="Type-safe"
          description="Full TypeScript inference with generic contexts and resources"
        />
        <FeatureCard
          icon="⚡"
          title="Async-first"
          description="Works seamlessly with databases, APIs, and DataLoader batching"
        />
        <FeatureCard
          icon="🔧"
          title="Framework-agnostic"
          description="Works with Express, Hono, Next.js, GraphQL, React, and more"
        />
        <FeatureCard
          icon="🪶"
          title="Zero dependencies"
          description="Lightweight and performant with no external dependencies"
        />
        <FeatureCard
          icon="🧪"
          title="Easy to test"
          description="Pure functions make permissions simple to test and debug"
        />
      </div>

      {/* Code Example */}
      <div className="max-w-4xl mx-auto mb-16">
        <h2 className="text-3xl font-bold mb-6 text-center">Quick Example</h2>
        <div className="bg-gray-900 rounded-lg p-6 overflow-x-auto">
          <pre className="text-sm">
            <code className="language-typescript text-gray-100">
              {`import { permission, or } from 'granter';

// Define permissions
const isAdmin = permission('isAdmin', (ctx) => 
  ctx.user.role === 'admin'
);

const isPostOwner = permission('isPostOwner', (ctx, post) => 
  post.authorId === ctx.user.id
);

// Compose permissions
const canEditPost = or(isPostOwner, isAdmin);

// Use them
if (await canEditPost(ctx, post)) {
  await updatePost(post);
}

// Or throw if not allowed
await canEditPost.orThrow(ctx, post);`}
            </code>
          </pre>
        </div>
      </div>

      {/* Installation */}
      <div className="max-w-2xl mx-auto text-center mb-16">
        <h2 className="text-3xl font-bold mb-6">Installation</h2>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm">
          npm install granter
        </div>
      </div>

      {/* Quick Links */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-center">Learn More</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <QuickLink
            href="/docs/getting-started"
            title="Getting Started"
            description="Install and use granter in 5 minutes"
          />
          <QuickLink
            href="/docs/permissions"
            title="Core Concepts"
            description="Learn about permissions and operators"
          />
          <QuickLink
            href="/docs/express"
            title="Express Example"
            description="Complete REST API example"
          />
          <QuickLink
            href="/docs/api-reference"
            title="API Reference"
            description="Full API documentation"
          />
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
    >
      <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
        {title} →
      </h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </Link>
  );
}
