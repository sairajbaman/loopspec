# App Flow — art marketplace with storefronts and secure purchasing

## User Journey
```
Landing → Login/Signup → Dashboard → [Feature Screens] → Settings
```

## Screens & States

### Auth Flow
| Screen | Route | Auth | States |
|--------|-------|------|--------|
| Login | /login | public | default, loading, error, success → redirect |
| Signup | /signup | public | default, loading, validation-error, success |
| Forgot Password | /forgot-password | public | default, loading, email-sent |

### Core Flow
| Screen | Route | Auth | States |
|--------|-------|------|--------|
| Product Catalog | /products | public | loading, empty, data, filtered |
| Product Detail | /products/:id | public | loading, data, not-found |
| Cart | /cart | public | empty, has-items |
| Checkout | /checkout | protected | address, payment, review, processing, confirmed |
| Order History | /orders | protected | loading, empty, data |

### Shared States (apply to all protected routes)
- **Unauthenticated** → redirect to /login with return URL
- **Network Error** → toast notification + retry button
- **403 Forbidden** → access denied page
- **404 Not Found** → not found page with back navigation

## Navigation
- Primary: sidebar (desktop) / bottom tabs (mobile)
- Secondary: breadcrumbs on detail pages
- Back: always available via browser history + explicit back button

## Transitions
- Page: fade (150ms)
- Modal: slide-up (200ms)
- Toast: slide-in from top-right (150ms), auto-dismiss 4s

---

> **AI Instructions:** When implementing each screen:
> 1. Handle ALL listed states (loading, empty, error, data)
> 2. Protected routes must check auth before rendering
> 3. Add skeleton loaders, not spinners
> 4. Empty states should have a clear CTA ("Create your first X")
> 5. Error states must offer retry action