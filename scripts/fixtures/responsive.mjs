export const longTitle = 'Indicação de estabelecimento com atendimento especializado em serviços para toda a família e disponibilidade aos finais de semana — '.repeat(2).slice(0, 200);
export const longDescription = `Procuro um local com atendimento de qualidade. ${'Detalhes sobre o serviço e disponibilidade. '.repeat(12)}`.slice(0, 500);
const longName = 'usuario_com_nome_extenso_para_validacao_1'.slice(0, 40);
const now = new Date();
const iso = (days) => new Date(now.getTime() + days * 86400000).toISOString();
export const point = { lat: -23.55052, lng: -46.633308 };
const place = { source: 'manual', selectionSource: 'map_pin', placeId: null, name: longTitle, address: longDescription, location: point };
const baseUser = { id: 1, username: longName, email: `${'contato'.repeat(15)}@example.com`, cityId: 1, cityName: 'São José do Vale do Rio Preto', cityState: 'RJ', reputation: 95, hasEvaluations: true, selectedAndEvaluatedCount: 100, validIndicationCount: 95, tutorialCompleted: true, shareCode: 'responsive', shareVisitCount: 125 };
export function userFor(role) { return { ...baseUser, isCompany: role === 'company', isAdmin: role === 'admin', accountType: role === 'company' ? 'company' : 'user' }; }
const request = { id: 123, title: longTitle, details: longDescription, contactMode: 'both', cityId: 1, cityName: 'São Paulo', cityState: 'SP', status: 'in_evaluation', statusLabel: 'Em avaliação', comparisonOpenedAt: iso(-1), selectedIndicationId: 15, evaluationDeadlineAt: iso(1), evaluationStartedAt: iso(-1), cycleNumber: 0, reopenCount: 0, indicationCount: 3, canEdit: false, createdAt: iso(-2), serverNow: iso(0) };
const indication = { id: 15, requestId: 123, description: longDescription, links: [`https://example.com/${'endereco-longo-'.repeat(12)}`], whatsappNumber: '5511999991234', place, contactMode: 'both', selected: true, status: 'selected', statusLabel: 'Selecionada', reputation: 95, requestTitle: longTitle, requestStatus: 'open', requestStatusLabel: 'Aberto', requestDetails: longDescription, canEdit: true, cityName: 'São Paulo', cityState: 'SP', recommender: { id: 2, username: longName }, createdAt: iso(-1), outcome: { kind: 'pending' } };
const ranking = { id: 10, title: longTitle, cityId: 1, cityName: baseUser.cityName, cityState: 'RJ', modality: 'weekly', modalityLabel: 'Semanal', status: 'open', statusLabel: 'Aberto', effectiveStatus: 'open', phase: 'ativos', phaseLabel: 'Ativo', periodStart: iso(-2), periodEnd: iso(5), periodStarted: true, acceptsEnrollment: true, enrolled: true, participantsCount: 100, prizePositions: [1, 2, 3], prizeBenefits: { default: longDescription }, prizeBenefitMode: 'equal', prizeRedemptionInstructions: longDescription, sponsored: true, sponsorName: longTitle, sponsorSiteUrl: 'https://example.com', regulationText: longDescription, redemptionDeadlineDays: 30 };
const sponsorship = { ...ranking, id: 20, status: 'submitted', statusLabel: 'Enviada', displayName: longTitle, companyLegalName: longTitle, companyCnpj: '11222333000181', cityName: baseUser.cityName, cityState: 'RJ', createdAt: iso(-1), siteUrl: 'https://example.com', bannerUrl: '/home/cta-pedir.png', editable: true, canEdit: true };
const company = { id: 2, legalName: longTitle, cnpj: '11222333000181', cityId: 1, cityName: baseUser.cityName, cityState: 'RJ', logoUrl: '' };
const reward = { id: 30, rankingId: 10, rankingTitle: longTitle, username: longName, position: 1, benefitText: longDescription, status: 'pending', statusLabel: 'Pendente', expiresAt: iso(30), redemptionInstructions: longDescription };
const hist = [{ id: 40, requestId: 123, requestTitle: longTitle, outcome: 'valid', reputationBefore: 90, delta: 5, reputationAfter: 95, createdAt: iso(-1) }];
export const scenarios = [
  ...['/', '/login', '/register', '/cadastro', '/empresa'].map(path => ({ role: 'guest', path })),
  ...['/', '/pedir', '/pedir/preview', '/pedir/meus', '/pedir/123', '/pedir/124/editar', '/indicar', '/indicar/123', '/indicar/123/nova', '/minhas-indicacoes', '/minhas-indicacoes/15', '/perfil', '/perfil/usuario_publico', '/perfil/reputacao', '/pontuacao', '/rankings', '/rankings/10', '/beneficios', '/missoes'].map(path => ({ role: 'user', path })),
  ...['/empresa', '/empresa/resgates', '/rankings', '/rankings/10', '/perfil'].map(path => ({ role: 'company', path })),
  ...['/admin', '/admin/patrocinios', '/admin/rankings', '/admin/rankings/mensal', '/admin/rankings/semanal', '/perfil'].map(path => ({ role: 'admin', path })),
];
export async function mockApi(route, role) {
  const url = new URL(route.request().url()); const path = url.pathname; const user = userFor(role);
  let data = {}; let status = 200;
  if (path === '/api/auth/me') { data = { user: role === 'guest' ? null : user }; if (role === 'guest') status = 401; }
  else if (path === '/api/notifications') data = { items: [{ id: 50, category: 'indications', categoryLabel: 'Indicações', title: longTitle, body: longDescription, deeplink: '/pedir/123', createdAt: iso(-1), read: false }], unreadTotal: 125, unreadByCategory: { indications: 125 } };
  else if (path === '/api/requests') data = { items: [request, { ...request, id: 124, status: 'open', statusLabel: 'Aberto', canEdit: true, comparisonOpenedAt: null }] };
  else if (/^\/api\/requests\/\d+\/comparison$/.test(path)) data = { request, indications: [indication, { ...indication, id: 16, hidden: true }] };
  else if (/^\/api\/requests\/\d+$/.test(path)) data = { item: path.endsWith('/124') ? { ...request, id: 124, status: 'open', canEdit: true, comparisonOpenedAt: null } : request, chosenIndications: [] };
  else if (path.startsWith('/api/indications/eligible/')) data = { item: { ...request, status: 'open', statusLabel: 'Aberto', acceptsIndications: true, comparisonOpenedAt: null } };
  else if (/^\/api\/indications\/\d+$/.test(path)) data = { item: indication };
  else if (path === '/api/indications') data = { items: url.searchParams.get('scope') === 'mine' ? [indication] : [{ ...request, status: 'open', createdAt: iso(-1) }], nextCursor: null };
  else if (path === '/api/profile/reputation-history') data = { items: hist };
  else if (path.startsWith('/api/profile/')) data = { profile: { ...baseUser, username: 'usuario_publico' } };
  else if (path === '/api/ibge/estados') data = { estados: [{ id: 35, sigla: 'SP', nome: 'São Paulo', label: 'São Paulo (SP)' }, { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro', label: 'Rio de Janeiro (RJ)' }, { id: 43, sigla: 'RS', nome: 'Rio Grande do Sul', label: 'Rio Grande do Sul (RS)' }] };
  else if (path === '/api/ibge/municipios') data = { municipios: ['São José do Vale do Rio Preto', 'Rio de Janeiro', 'Campos dos Goytacazes', 'Cachoeiras de Macacu', 'São Francisco de Itabapoana'].map((nome, index) => ({ id: 3300001 + index, nome, uf: url.searchParams.get('uf') })) };
  else if (path === '/api/cities') data = { cities: [{ id: 1, name: baseUser.cityName, state: 'RJ', label: `${baseUser.cityName} (RJ)` }] };
  else if (path === '/api/cities/ensure') data = { city: { id: 1, name: baseUser.cityName, state: 'RJ' } };
  else if (path === '/api/rankings') data = { items: [ranking, { ...ranking, id: 11, modality: 'monthly', modalityLabel: 'Mensal' }], limits: { weekly: { enrolled: 1, max: 2 }, monthly: { enrolled: 0, max: 1 } }, pointsAccumulated: 123456, myCity: { id: 1, name: baseUser.cityName, state: 'RJ' }, companyScope: role === 'company' };
  else if (/^\/api\/rankings\/\d+$/.test(path)) data = { ranking, standings: Array.from({ length: 12 }, (_, i) => ({ userId: i + 1, username: longName, position: i + 1, points: 123456 - i, balance: 123456 - i, validCountInPeriod: 100, shareVisitCount: 123456, reputation: 95 })), me: { userId: 1, position: 1, balance: 123456, status: 'active' }, prize: { benefitText: longDescription } };
  else if (path === '/api/empresa') data = { user, company };
  else if (path === '/api/empresa/slots') data = { items: ['weekly', 'monthly'].map(modality => ({ key: `${modality}-test`, modality, modalityLabel: modality === 'weekly' ? 'Semanal' : 'Mensal', cityId: 1, cityName: baseUser.cityName, cityState: 'RJ', periodStart: iso(7), periodEnd: iso(14), alreadyRequested: false })) };
  else if (path === '/api/empresa/sponsorships') data = { items: [sponsorship, { ...sponsorship, id: 21, status: 'rejected', statusLabel: 'Rejeitada' }] };
  else if (path === '/api/empresa/rewards') data = { items: [reward] };
  else if (path === '/api/admin/sponsorships') data = { items: [sponsorship] };
  else if (path === '/api/admin/rankings') data = { rankings: [ranking, { ...ranking, id: 11, phase: 'agendados' }, { ...ranking, id: 12, phase: 'finalizados', status: 'final' }], pending: [sponsorship] };
  else if (path === '/api/places/map-config' && url.searchParams.get('cityName') === 'São Paulo' && url.searchParams.get('cityState') === 'SP') data = { provider: 'openstreetmap', tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors', center: point };
  await route.fulfill({ status, json: data });
}
export async function seedBrowser(context) {
  await context.addInitScript(({ longTitle, longDescription }) => {
    sessionStorage.setItem('indica_request_draft', JSON.stringify({ title: longTitle, details: longDescription, contactMode: 'both', cityId: 1, cityName: 'São Paulo', state: 'SP', cityLabel: 'São Paulo (SP)' }));
  }, { longTitle, longDescription });
}
