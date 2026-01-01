# Contributing to FileSoldier

First off, thank you for considering contributing to FileSoldier! 🎉

FileSoldier is an open-source, privacy-first file sharing platform, and we welcome contributions from the community. This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Security](#security)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- Be respectful and considerate in your communications
- Welcome newcomers and help them get started
- Focus on what is best for the community and the project
- Show empathy towards other community members

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/filesoldier.git
   cd filesoldier
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/filesoldier.git
   ```

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or bun
- A Supabase account (for database and storage)
- Cloudflare Turnstile keys (for bot protection)

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key
   - `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret key

3. Install dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs **actual behavior**
- **Screenshots** if applicable
- **Environment details** (browser, OS, Node version)

### Suggesting Features

Feature requests are welcome! Please:

- Check if the feature has already been requested
- Provide a clear description of the feature
- Explain why this feature would be useful
- Consider how it aligns with FileSoldier's privacy-first philosophy

### Contributing Code

1. **Find an issue** to work on, or create one for discussion
2. **Comment on the issue** to let others know you're working on it
3. **Create a branch** from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```
4. **Make your changes** following our coding standards
5. **Test your changes** thoroughly
6. **Submit a pull request**

## Pull Request Process

1. **Ensure your code builds** without errors:
   ```bash
   npm run build
   ```

2. **Run linting** and fix any issues:
   ```bash
   npm run lint
   ```

3. **Update documentation** if you're changing functionality

4. **Write a clear PR description** explaining:
   - What changes you made
   - Why you made them
   - Any breaking changes
   - Related issue numbers (use `Fixes #123` or `Closes #123`)

5. **Request review** from maintainers

6. **Address feedback** promptly and respectfully

### PR Requirements

- [ ] Code builds successfully (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] Changes are tested locally
- [ ] Documentation updated if needed
- [ ] Commit messages follow our guidelines

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types; avoid `any` when possible
- Use interfaces for object shapes
- Export types that might be used elsewhere

### React/Next.js

- Use functional components with hooks
- Keep components small and focused
- Use `'use client'` directive only when necessary
- Prefer server components when possible

### Styling

- Use Tailwind CSS for styling
- Follow existing naming conventions
- Keep styles consistent with the design system

### File Structure

```
src/
├── app/           # Next.js App Router pages and API routes
├── components/    # React components
│   └── ui/        # Reusable UI components (shadcn/ui)
├── lib/           # Utility libraries and configurations
├── utils/         # Helper functions
└── styles/        # Global styles
```

### Security Considerations

Given FileSoldier's security-focused nature:

- **Never log sensitive data** (encryption keys, passwords, file contents)
- **Validate all inputs** using Zod or similar
- **Sanitize outputs** to prevent XSS
- **Follow the zero-knowledge principle** - server should never access decrypted data
- **Use prepared statements** for database queries

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring without feature changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build, etc.)
- `security`: Security improvements

### Examples

```bash
feat(upload): add drag-and-drop file upload
fix(download): resolve decryption error for large files
docs(readme): update installation instructions
security(api): add rate limiting to upload endpoint
```

## Security

### Reporting Security Vulnerabilities

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them responsibly by:

1. Emailing the maintainers directly (check the README for contact info)
2. Providing detailed information about the vulnerability
3. Allowing reasonable time for a fix before public disclosure

We take security seriously and will respond promptly to valid reports.

### Security Best Practices for Contributors

- Review the [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) file
- Understand the encryption flow before modifying crypto-related code
- Test changes thoroughly, especially for security-sensitive features
- Consider edge cases and potential attack vectors

## Questions?

If you have questions about contributing, feel free to:

- Open a GitHub Discussion
- Check existing issues and discussions
- Reach out to maintainers

---

Thank you for contributing to FileSoldier! Your efforts help make secure file sharing accessible to everyone. 🔐
