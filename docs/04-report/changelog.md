# Changelog

## [2026-03-27] - domain-refactor PDCA Completion

### Added
- Domain-based layered architecture with 11 modules (common, budget, infra)
- 33 class renames for improved code readability (CcodemRepository → CodeRepository, etc.)
- budget/document subdomain consolidation for document management
- RBAC infrastructure preparation (SecurityContext mocking, permission validation)
- Comprehensive test coverage (45 tests, 100% pass rate)

### Changed
- Flat package structure (com.kdb.it.*) → Domain-based structure (com.kdb.it/common/budget/infra)
- Class naming convention: DB-prefix based → Domain/business semantic naming
- Package reorganization for ~100 Java files across 11 modules
- CLAUDE.md §4.2 directory structure documentation updated

### Fixed
- Test file package declarations (6 files: AuthControllerTest, ProjectControllerTest, etc.)
- QuerydslConfig JavaDoc references to old class names
- GeminiService cross-domain dependency documentation (design variance)
- All 9 gaps resolved from initial 95% match rate to 100%

### Technical Details
- Spring Boot 4.0.1 / Java 25 backend refactoring
- 100% single-direction dependency enforcement (budget → common, infra → common)
- QueryDSL Q-class auto-regeneration via ./gradlew clean build
- Frontend TypeScript type synchronization completed (Module-11)

### Quality Metrics
- Match Rate: 100% (up from 95%)
- Test Pass Rate: 45/45 (100%)
- Build Status: BUILD SUCCESSFUL
- No breaking changes to APIs or database schema
