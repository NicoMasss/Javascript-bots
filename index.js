const axios = require("axios");

const codigoTipoVeiculo = 1;

// Função para adicionar um delay (evita erro 429)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function pegaMes() {
    const response = await axios.post("https://veiculos.fipe.org.br/api/veiculos//ConsultarTabelaDeReferencia")
        
    return response.data[0].Codigo
}

// Busca o valor do carro na FIPE
async function dadosCarro(codigoTabelaReferencia, modeloCodigo, marcaId, codigoTipoCombustivel, anoModelo) {
    await delay(500); // Delay fixo entre requisições
    const response = await axios.post("https://veiculos.fipe.org.br/api/veiculos/ConsultarValorComTodosParametros", {
        codigoTabelaReferencia,
        codigoTipoVeiculo,
        codigoModelo: modeloCodigo,
        codigoMarca: marcaId,
        codigoTipoCombustivel,
        anoModelo,
        tipoVeiculo: "carro",
        tipoConsulta: "tradicional"
    });
    return response.data;
}

// Busca todas as marcas de veículos
async function marcaCarro(codigoTabelaReferencia) {
    await delay(300); // Pequeno delay antes da requisição
    const response = await axios.post("https://veiculos.fipe.org.br/api/veiculos/ConsultarMarcas", {
        codigoTabelaReferencia,
        codigoTipoVeiculo
    });
    return response.data;
}

// Busca os modelos de uma marca específica
async function modeloCarro(codigoTabelaReferencia, marcaId) {
    await delay(300);
    const response = await axios.post("https://veiculos.fipe.org.br/api/veiculos/ConsultarModelos", {
        codigoTabelaReferencia,
        codigoTipoVeiculo,
        codigoMarca: marcaId
    });
    return response.data.Modelos;
}

// Busca os anos disponíveis para um modelo
async function recebeAnoModelo(codigoTabelaReferencia, marcaId, modelosCodigo) {
    await delay(300);
    const response = await axios.post("https://veiculos.fipe.org.br/api/veiculos/ConsultarAnoModelo", {
        codigoTabelaReferencia,
        codigoTipoVeiculo,
        codigoMarca: marcaId,
        codigoModelo: modelosCodigo
    });
    return response.data;
}

// Função que processa os dados em pequenos lotes para evitar 429
async function processarEmLotes(itens, funcao, delayEntreLotes = 1000) {
    const resultados = [];
    
    for (const item of itens) {
        try {
            const resultado = await funcao(item);
            resultados.push(resultado);
        } catch (error) {
            console.error("Erro em um item:", error);
        }
        await delay(delayEntreLotes); // Pequena pausa entre os lotes
    }

    return resultados;
}

// Função principal
async function obterDadosMarcasModelos() {
    try {
        const codigoTabelaReferencia = await pegaMes()

        console.log("Buscando marcas...");
        const marcas = await marcaCarro(codigoTabelaReferencia);
        const objDados = [];

        for (const marca of marcas) {
            const marcaId = marca.Value;
            console.log(`Buscando modelos da marca: ${marca.Label}`);

            const modelosModelos = await modeloCarro(codigoTabelaReferencia, marcaId);
            const loteModelos = modelosModelos.slice(0, 3); // Testando com 3 modelos

            // Busca anos modelo em lotes
            const anosModelosResultados = await processarEmLotes(loteModelos, async (modelo) => {
                const modelosCodigo = modelo.Value;
                return { modelo, anosModelo: await recebeAnoModelo(codigoTabelaReferencia, marcaId, modelosCodigo) };
            });

            // Busca os valores dos carros em lotes
            for (const { modelo, anosModelo } of anosModelosResultados) {
                const modelosCodigo = modelo.Value;
                const modeloNome = modelo.Label;

                const resultadosValores = await processarEmLotes(anosModelo, async (ano) => {
                    const [anoModelo, codigoTipoCombustivel] = ano.Value.split("-");
                    console.log(`Buscando preço para: ${marca.Label} ${modeloNome} ${anoModelo}`);
                    const dadosCarroFinal = await dadosCarro(codigoTabelaReferencia, modelosCodigo, marcaId, codigoTipoCombustivel, anoModelo);
                    const valorCarro =  dadosCarroFinal.Valor
                    const codigoFipe =  dadosCarroFinal.CodigoFipe

                    return {
                        marca: marca.Label,
                        modelo: modeloNome,
                        fipe: codigoFipe,
                        ano: anoModelo,
                        valor: valorCarro
                    };
                }, 1000); // Tempo entre requisições de valores

                objDados.push(resultadosValores);
            }
        }

        console.log("Dados coletados:", objDados);
    } catch (error) {
        console.error(" Ocorreu um erro:", error);
    }
}


obterDadosMarcasModelos();
 