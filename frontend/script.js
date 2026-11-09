let dadosCompletos = [];
let charts = {};

const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

async function carregarDados() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    try {
        const resposta = await fetch('http://127.0.0.1:8000/api/producao');
        const dados = await resposta.json();

        if (dados.erro_detalhado) {
            alert('Erro no Databricks: ' + dados.erro_detalhado);
            return;
        }

        dadosCompletos = dados;
        popularFiltros();
        atualizarDashboard();

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
    } catch (erro) {
        alert('Não foi possível conectar ao backend FastAPI. Verifique se o uvicorn está rodando na porta 8000.');
        console.error(erro);
    }
}

function popularFiltros() {
    const unidades = [...new Set(dadosCompletos.map(d => d.unidade).filter(Boolean))].sort();
    const convenios = [...new Set(dadosCompletos.map(d => d.convenio).filter(Boolean))].sort();

    const selUnidade = document.getElementById('filtroUnidade');
    selUnidade.innerHTML = '<option value="TODAS">Todas as Unidades</option>';
    unidades.forEach(u => selUnidade.innerHTML += `<option value="${u}">${u}</option>`);

    const selConvenio = document.getElementById('filtroConvenio');
    selConvenio.innerHTML = '<option value="TODOS">Todos os Convênios</option>';
    convenios.forEach(c => selConvenio.innerHTML += `<option value="${c}">${c}</option>`);
}

function atualizarDashboard() {
    const unidadeSel = document.getElementById('filtroUnidade').value;
    const convenioSel = document.getElementById('filtroConvenio').value;

    const filtrados = dadosCompletos.filter(item => {
        const matchUnidade = unidadeSel === 'TODAS' || item.unidade === unidadeSel;
        const matchConvenio = convenioSel === 'TODOS' || item.convenio === convenioSel;
        return matchUnidade && matchConvenio;
    });

    // Cálculo de KPIs
    const receitaTotal = filtrados.reduce((acc, item) => acc + (Number(item.receita) || 0), 0);
    const totalAtendimentos = new Set(filtrados.map(item => item.nr_atendimento)).size;
    const totalItens = filtrados.reduce((acc, item) => acc + (Number(item.qtd_itens) || 0), 0);
    const ticketMedio = totalAtendimentos > 0 ? receitaTotal / totalAtendimentos : 0;

    document.getElementById('kpiReceita').innerText = formatarMoeda(receitaTotal);
    document.getElementById('kpiAtendimentos').innerText = totalAtendimentos.toLocaleString('pt-BR');
    document.getElementById('kpiItens').innerText = totalItens.toLocaleString('pt-BR');
    document.getElementById('kpiTicket').innerText = formatarMoeda(ticketMedio);

    renderizarGraficos(filtrados);
    renderizarTabela(filtrados);
}

function renderizarGraficos(dados) {
    // 1. Evolução por Data
    const porData = {};
    dados.forEach(d => {
        porData[d.dt_atendimento] = (porData[d.dt_atendimento] || 0) + Number(d.receita || 0);
    });
    const labelsData = Object.keys(porData).sort();
    const valoresData = labelsData.map(k => porData[k]);

    criarOuAtualizarChart('graficoEvolucao', 'line', labelsData, valoresData, 'Receita (R$)', '#38bdf8');

    // 2. Por Tipo de Atendimento
    const porTipo = {};
    dados.forEach(d => {
        const tipo = d.tipo_atendimento || 'Não informado';
        porTipo[tipo] = (porTipo[tipo] || 0) + Number(d.receita || 0);
    });
    criarOuAtualizarChart('graficoTipo', 'doughnut', Object.keys(porTipo), Object.values(porTipo), 'Receita', ['#10b981', '#38bdf8', '#f59e0b', '#a855f7', '#f43f5e']);

    // 3. Por Convênio
    const porConvenio = {};
    dados.forEach(d => {
        const conv = d.convenio || 'Outros';
        porConvenio[conv] = (porConvenio[conv] || 0) + Number(d.receita || 0);
    });
    const convOrdenado = Object.entries(porConvenio).sort((a, b) => b[1] - a[1]);
    criarOuAtualizarChart('graficoConvenio', 'bar', convOrdenado.map(c => c[0]), convOrdenado.map(c => c[1]), 'Receita (R$)', '#10b981');
}

function criarOuAtualizarChart(idCanvas, tipo, labels, data, labelDataset, cores) {
    if (charts[idCanvas]) charts[idCanvas].destroy();

    const ctx = document.getElementById(idCanvas).getContext('2d');
    charts[idCanvas] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: labels,
            datasets: [{
                label: labelDataset,
                data: data,
                backgroundColor: Array.isArray(cores) ? cores : cores + '33',
                borderColor: Array.isArray(cores) ? '#1e293b' : cores,
                borderWidth: 2,
                fill: tipo === 'line',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: tipo === 'doughnut', labels: { color: '#cbd5e1' } }
            },
            scales: tipo === 'doughnut' ? {} : {
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            }
        }
    });
}

function renderizarTabela(dados) {
    const tbody = document.getElementById('tabelaCorpo');
    tbody.innerHTML = '';

    dados.slice(-30).reverse().forEach(row => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-700/40">
                <td class="py-2 px-3 font-medium text-slate-200">${row.nr_atendimento}</td>
                <td class="py-2 px-3 text-slate-400">${row.dt_atendimento}</td>
                <td class="py-2 px-3 text-slate-300">${row.unidade}</td>
                <td class="py-2 px-3 text-slate-300">${row.convenio}</td>
                <td class="py-2 px-3 text-slate-400">${row.tipo_atendimento}</td>
                <td class="py-2 px-3 text-right font-medium text-emerald-400">${formatarMoeda(row.receita)}</td>
            </tr>
        `;
    });
}

document.getElementById('filtroUnidade').addEventListener('change', atualizarDashboard);
document.getElementById('filtroConvenio').addEventListener('change', atualizarDashboard);

// Inicia automaticamente ao abrir a página
carregarDados();