import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <svg
            width="24"
            height="24"
            viewBox="0 0 256 256"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Logo"
          >
            <rect width="256" height="256" rx="4" fill="#060713"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M48 64L128 192L171.646 122.166L158.989 115.415L142.867 141.211L103.018 77.4523L182.716 77.4523L166.282 103.747L178.939 110.497L208 64L48 64Z" fill="white"/>
          </svg>
          vlayer docs
        </>
      ),
    },
    // see https://fumadocs.dev/docs/ui/navigation/links
    links: [],
  };
}
