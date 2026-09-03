import { defineConfig } from "vitepress"

export default defineConfig({
  title: "HotelPMS Docs",
  description:
    "Documentation for HotelPMS, the open-source AI-native hotel PMS - install, self-host, connect your AI over MCP, and run your property.",
  base: "/docs/",
  cleanUrls: true,
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/docs/hotelpms-mark.svg" }]],
  themeConfig: {
    logo: { src: "/hotelpms-horizontal.svg", height: 28 },
    siteTitle: false,
    nav: [
      { text: "Website", link: "https://hotelpms.yemenfrappe.com" },
      { text: "Live demo", link: "https://demo.hotelpms.yemenfrappe.com" },
      { text: "GitHub", link: "https://github.com/YemenFrappe/hotelpms" },
    ],
    search: { provider: "local" },
    socialLinks: [
      { icon: "github", link: "https://github.com/YemenFrappe/hotelpms" },
    ],
    footer: {
      message: "Open source (AGPL-3.0) · every feature included, always.",
      copyright: "HotelPMS · hello@hotelpms.yemenfrappe.com",
    },
    sidebar: [
      {
        text: "Getting started",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Quickstart (Docker)", link: "/quickstart" },
          { text: "Try the live demo", link: "/demo" },
          { text: "Go-live checklist", link: "/go-live" },
          { text: "FAQ", link: "/faq" },
        ],
      },
      {
        text: "Self-hosting",
        items: [
          { text: "Overview & requirements", link: "/self-hosting/" },
          { text: "Hostinger", link: "/self-hosting/hostinger" },
          { text: "DigitalOcean", link: "/self-hosting/digitalocean" },
          { text: "Linode (Akamai)", link: "/self-hosting/linode" },
          { text: "AWS", link: "/self-hosting/aws" },
          { text: "Install with bench", link: "/self-hosting/bench" },
          { text: "Frappe Cloud marketplace", link: "/self-hosting/frappe-cloud" },
          { text: "Email (SMTP) setup", link: "/self-hosting/email" },
        ],
      },
      {
        text: "Using HotelPMS",
        items: [
          { text: "Features tour", link: "/features" },
          { text: "WhatsApp on your number", link: "/whatsapp" },
          { text: "Channel manager (OTA sync)", link: "/channel-manager" },
          { text: "User guide", link: "/user-guide" },
        ],
      },
      {
        text: "AI & integrations",
        items: [
          { text: "Connect your AI (MCP)", link: "/ai-and-mcp" },
          { text: "MCP tool reference", link: "/mcp-tools" },
          { text: "REST API basics", link: "/api" },
          { text: "REST API reference", link: "/api-reference" },
        ],
      },
      { text: "FAQ", items: [{ text: "FAQ", link: "/faq" }] },
    ],
  },
})
