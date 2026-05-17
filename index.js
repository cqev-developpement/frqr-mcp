#!/usr/bin/env node
/**
 * frqr MCP Server
 * Expose les outils frqr.app (liens courts, QR codes, stats) à tout client MCP.
 *
 * Usage :
 *   FRQR_API_TOKEN=frqr_pk_... node index.js
 *
 * Claude Desktop (~/.config/claude/claude_desktop_config.json) :
 *   { "mcpServers": { "frqr": {
 *       "command": "node",
 *       "args": ["/chemin/vers/mcp-server/index.js"],
 *       "env": { "FRQR_API_TOKEN": "frqr_pk_..." }
 *   }}}
 */

import { Server }               from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ── Config ──────────────────────────────────────────────────────────────────
const TOKEN    = process.env.FRQR_API_TOKEN ?? '';
const API_BASE = process.env.FRQR_API_BASE  ?? 'https://frqr.app/api/v2';

if (!TOKEN) {
  process.stderr.write(
    '[frqr-mcp] FRQR_API_TOKEN manquant.\n' +
    'Ajoutez-le dans la config MCP ou exportez la variable : export FRQR_API_TOKEN=frqr_pk_...\n'
  );
  process.exit(1);
}

// ── HTTP helper ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  try   { return JSON.parse(text); }
  catch { return { raw: text, status: res.status }; }
}

// ── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name:        'create_link',
    description: 'Raccourcit une URL longue et retourne un lien court frqr.app avec son slug.',
    inputSchema: {
      type: 'object',
      properties: {
        url:   { type: 'string',  description: 'URL longue à raccourcir (obligatoire)' },
        slug:  { type: 'string',  description: 'Slug personnalisé (optionnel, ex : mon-produit)' },
        title: { type: 'string',  description: 'Titre descriptif du lien (optionnel)' },
      },
      required: ['url'],
    },
  },
  {
    name:        'list_links',
    description: 'Liste vos liens courts avec pagination. Supporte la recherche par titre ou URL.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string',  description: 'Terme de recherche (optionnel)' },
        page:   { type: 'integer', description: 'Numéro de page, défaut 1 (optionnel)' },
      },
    },
  },
  {
    name:        'get_link_stats',
    description: 'Retourne les statistiques complètes d\'un lien court : clics totaux, pays, appareils, navigateurs, évolution temporelle.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug du lien court (ex : abc123)' },
      },
      required: ['slug'],
    },
  },
  {
    name:        'update_link',
    description: 'Modifie la destination, le titre ou l\'état (actif/désactivé) d\'un lien court existant.',
    inputSchema: {
      type: 'object',
      properties: {
        slug:        { type: 'string',  description: 'Slug du lien à modifier (obligatoire)' },
        url:         { type: 'string',  description: 'Nouvelle URL de destination (optionnel)' },
        title:       { type: 'string',  description: 'Nouveau titre (optionnel)' },
        is_disabled: { type: 'boolean', description: 'true pour désactiver, false pour réactiver (optionnel)' },
      },
      required: ['slug'],
    },
  },
  {
    name:        'delete_link',
    description: 'Supprime définitivement un lien court frqr.app.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug du lien à supprimer' },
      },
      required: ['slug'],
    },
  },
  {
    name:        'create_qr',
    description: 'Génère un QR code frqr.app trackable pour une URL. Retourne l\'ID et les URLs de téléchargement PNG/SVG.',
    inputSchema: {
      type: 'object',
      properties: {
        url:  { type: 'string', description: 'URL cible du QR code (obligatoire)' },
        name: { type: 'string', description: 'Nom du QR code (optionnel)' },
      },
      required: ['url'],
    },
  },
  {
    name:        'list_qr_codes',
    description: 'Liste vos QR codes frqr.app avec pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'integer', description: 'Numéro de page, défaut 1 (optionnel)' },
      },
    },
  },
  {
    name:        'get_qr_stats',
    description: 'Retourne les statistiques de scan d\'un QR code : scans totaux, pays, appareils.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID du QR code' },
      },
      required: ['id'],
    },
  },
  {
    name:        'report',
    description: 'Génère un rapport résumé de votre compte frqr : total liens, QR codes, clics, top liens.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ── Server ───────────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'frqr', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  const { name, arguments: a = {} } = params;

  try {
    let result;

    switch (name) {
      case 'create_link': {
        const body = { url: a.url };
        if (a.slug)  body.slug  = a.slug;
        if (a.title) body.title = a.title;
        result = await api('POST', '/links', body);
        break;
      }
      case 'list_links': {
        const qs = new URLSearchParams();
        if (a.search) qs.set('search', a.search);
        if (a.page)   qs.set('page',   String(a.page));
        result = await api('GET', `/links?${qs}`);
        break;
      }
      case 'get_link_stats':
        result = await api('GET', `/links/${a.slug}/stats`);
        break;

      case 'update_link': {
        const body = {};
        if (a.url         !== undefined) body.url         = a.url;
        if (a.title       !== undefined) body.title       = a.title;
        if (a.is_disabled !== undefined) body.is_disabled = a.is_disabled;
        result = await api('PATCH', `/links/${a.slug}`, body);
        break;
      }
      case 'delete_link':
        result = await api('DELETE', `/links/${a.slug}`);
        break;

      case 'create_qr': {
        const body = { url: a.url };
        if (a.name) body.name = a.name;
        result = await api('POST', '/qr-codes', body);
        break;
      }
      case 'list_qr_codes': {
        const qs = new URLSearchParams();
        if (a.page) qs.set('page', String(a.page));
        result = await api('GET', `/qr-codes?${qs}`);
        break;
      }
      case 'get_qr_stats':
        result = await api('GET', `/qr-codes/${a.id}/stats`);
        break;

      case 'report': {
        // Agrège les données disponibles en un rapport lisible
        const [links, qrs] = await Promise.all([
          api('GET', '/links?page=1'),
          api('GET', '/qr-codes?page=1'),
        ]);
        result = {
          links_total:    links?.meta?.total     ?? '?',
          qr_total:       qrs?.meta?.total       ?? '?',
          links_sample:   (links?.data ?? []).slice(0, 5).map(l => ({
            slug: l.slug, short_url: l.short_url, clicks: l.clicks ?? 0, title: l.title,
          })),
          qr_sample:      (qrs?.data ?? []).slice(0, 5).map(q => ({
            id: q.id, name: q.name, scans: q.scans ?? 0,
          })),
        };
        break;
      }

      default:
        throw new Error(`Outil inconnu : ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Erreur frqr-mcp : ${err.message}` }],
      isError: true,
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
