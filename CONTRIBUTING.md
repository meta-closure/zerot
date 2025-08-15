# Contributing to zerot

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/meta-closure/zerot.git
   cd zerot
   npm install
   ```

2. **Verify setup**
   ```bash
   npm test      # Run tests
   npm run build # Build the project
   ```

## Project Structure

```
zerot/
├── src/                   # Source code
│   ├── core/             # Core contract system
│   ├── conditions/       # Built-in conditions
│   ├── integrations/     # Framework integrations
│   ├── config/           # Project configs
│   ├── types/            # TypeScript types
│   ├── templates/        #
│   └── utils/            # Utilities
└── examples/             # Usage examples
```

## Making Changes

### Branch naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new condition
fix: resolve auth issue
docs: update API examples
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

Write tests for new features and ensure existing tests pass.

## Pull Requests

1. Fork the repo and create a feature branch
2. Make your changes with tests
3. Update documentation if needed
4. Open a PR with a clear description

### PR Checklist

- [ ] Tests pass
- [ ] Code follows existing style
- [ ] Documentation updated
- [ ] Changelog updated (if needed)

## Questions?

- Open a [GitHub issue](https://github.com/meta-closure/zerot/issues)
- Check the [documentation](https://meta-closure.github.io/zerot/)
