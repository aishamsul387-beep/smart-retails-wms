export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <section
        className="w-full max-w-md rounded-lg bg-white p-8 shadow-md"
        aria-labelledby="login-title"
      >
        <header className="mb-6 text-center">
          <h1 id="login-title" className="text-2xl font-bold text-gray-900">
            SmartRetails WMS
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your warehouse management system
          </p>
        </header>

        <form className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email Address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Enter your email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Sign In
          </button>
        </form>
      </section>
    </main>
  );
}