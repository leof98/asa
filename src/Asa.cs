// Asa: o assistente de tour da Criando Valor (plano de voo de fotos e de vídeo).
// A janela é nativa (Windows Forms) e mostra as telas da pasta app\ num WebView2, o mesmo motor do Edge que a Central usa.
// Tudo o que a página não pode fazer sozinha passa por aqui: projetos como arquivos em Documentos\Asa, a chave do Google
// protegida pelo Windows, o PDF direto (sem a janela de impressão), os downloads salvos na pasta do projeto, os avisos do
// Windows e a atualização pelo GitHub.
// C# 5 (compila com o csc do próprio Windows, .NET Framework 4): veja Compilar.cmd.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Asa")]
[assembly: AssemblyProduct("Asa")]
[assembly: AssemblyDescription("Asa: assistente de tour (plano de voo de fotos e de vídeo)")]
[assembly: AssemblyCompany("Criando Valor")]
[assembly: AssemblyVersion("0.1.0.0")]
[assembly: AssemblyFileVersion("0.1.0.0")]

static class Programa
{
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr valor);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] internal static extern IntPtr FindWindow(string classe, string titulo);
    [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr janela);
    [DllImport("user32.dll")] internal static extern bool ShowWindow(IntPtr janela, int modo);

    [STAThread]
    static void Main(string[] args)
    {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (Exception) { try { SetProcessDPIAware(); } catch (Exception) { } }
        bool novo;
        using (Mutex unico = new Mutex(true, "Asa.CriandoValor.UmaJanela", out novo))
        {
            if (!novo)
            {
                // o Asa já está aberto: traz a janela para a frente em vez de abrir outro
                IntPtr j = FindWindow(null, "Asa");
                if (j != IntPtr.Zero) { ShowWindow(j, 9); SetForegroundWindow(j); }
                return;
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            Application.Run(new Janela());
        }
    }
}

sealed class Janela : Form
{
    internal const string Versao = "0.2.0";
    readonly WebView2 web;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    readonly string pastaApp, pastaDados, pastaAsa, pastaProjetos, pastaModelos, pastaLocais;
    string projetoAtual = "", proximoArquivo = "";
    NotifyIcon aviso;

    public Janela()
    {
        json.MaxJsonLength = int.MaxValue;
        pastaApp = Path.GetDirectoryName(Application.ExecutablePath);
        pastaDados = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Asa");
        pastaAsa = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Asa");
        pastaProjetos = Path.Combine(pastaAsa, "Projetos");
        pastaModelos = Path.Combine(pastaAsa, "Modelos");
        pastaLocais = Path.Combine(pastaAsa, "Locais");
        foreach (string p in new string[] { pastaDados, pastaProjetos, pastaModelos, pastaLocais }) Directory.CreateDirectory(p);

        Text = "Asa";
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }
        BackColor = Color.FromArgb(0x0b, 0x07, 0x10);
        MinimumSize = new Size(1000, 640);
        StartPosition = FormStartPosition.Manual;
        RestaurarPosicao();

        web = new WebView2();
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = BackColor;
        CoreWebView2CreationProperties props = new CoreWebView2CreationProperties();
        props.UserDataFolder = Path.Combine(pastaDados, "WebView2");
        web.CreationProperties = props;
        Controls.Add(web);
        Load += AoCarregar;
        FormClosing += AoFechar;
    }

    // Ao fechar: dá um instante para a página gravar a última mudança do projeto
    bool saindo;
    async void AoFechar(object s, FormClosingEventArgs e)
    {
        if (!saindo && web != null && web.CoreWebView2 != null)
        {
            e.Cancel = true;
            saindo = true;
            try { await web.CoreWebView2.ExecuteScriptAsync("typeof GRAV!=='undefined'&&GRAV.agora()"); } catch (Exception) { }
            await Task.Delay(1200);
            Close();
            return;
        }
        GuardarPosicao();
        if (aviso != null) { aviso.Visible = false; aviso.Dispose(); }
    }

    async void AoCarregar(object s, EventArgs e)
    {
        try
        {
            await web.EnsureCoreWebView2Async(null);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "O Asa precisa do Microsoft Edge WebView2, que vem com o Windows 10 e 11.\n\n" + ex.Message, "Asa", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }
        CoreWebView2 c = web.CoreWebView2;
        c.Settings.AreDevToolsEnabled = File.Exists(Path.Combine(pastaDados, "depurar"));
        c.Settings.AreBrowserAcceleratorKeysEnabled = false;   // Ctrl+P, Ctrl+S etc. ficam com o Asa
        c.Settings.IsStatusBarEnabled = false;
        c.Settings.IsZoomControlEnabled = false;
        c.SetVirtualHostNameToFolderMapping("asa.local", Path.Combine(pastaApp, "app"), CoreWebView2HostResourceAccessKind.Allow);
        c.WebMessageReceived += AoMensagem;
        c.DownloadStarting += AoBaixar;
        c.NewWindowRequested += delegate (object o, CoreWebView2NewWindowRequestedEventArgs a) { a.Handled = true; Abrir(a.Uri); };
        c.Navigate("https://asa.local/index.html");
        CriarAtalho();
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Mensagens da página: {id, cmd, a} → {id, ok, r} ou {id, ok:false, erro}
    async void AoMensagem(object s, CoreWebView2WebMessageReceivedEventArgs e)
    {
        Dictionary<string, object> m;
        try { m = json.DeserializeObject(e.WebMessageAsJson) as Dictionary<string, object>; }
        catch (Exception) { return; }
        if (m == null) return;
        string id = Txt(m, "id"), cmd = Txt(m, "cmd");
        Dictionary<string, object> a = (m.ContainsKey("a") ? m["a"] : null) as Dictionary<string, object> ?? new Dictionary<string, object>();
        Dictionary<string, object> resp = new Dictionary<string, object>();
        resp["id"] = id;
        try
        {
            resp["r"] = await Executar(cmd, a);
            resp["ok"] = true;
        }
        catch (Exception ex)
        {
            resp["ok"] = false;
            resp["erro"] = ex.Message;
        }
        try { web.CoreWebView2.PostWebMessageAsJson(json.Serialize(resp)); } catch (Exception) { }
    }

    void Evento(string nome, Dictionary<string, object> dados)
    {
        dados["evento"] = nome;
        try { web.CoreWebView2.PostWebMessageAsJson(json.Serialize(dados)); } catch (Exception) { }
    }

    async Task<object> Executar(string cmd, Dictionary<string, object> a)
    {
        switch (cmd)
        {
            case "info":
                {
                    Dictionary<string, object> r = new Dictionary<string, object>();
                    r["versao"] = Versao;
                    r["pastaAsa"] = pastaAsa;
                    r["pastaProjetos"] = pastaProjetos;
                    r["pastaLocais"] = pastaLocais;
                    r["pastaApp"] = pastaApp;
                    return r;
                }
            case "config.ler": return LerConfig();
            case "config.gravar": GravarConfig(a); return true;
            case "proj.listar": return ListarProjetos(Base(a));
            case "proj.ler": return File.ReadAllText(Projeto(Base(a), Txt(a, "arquivo")), Encoding.UTF8);
            case "proj.gravar": return GravarProjeto(Base(a), Txt(a, "arquivo"), Txt(a, "texto"), Txt(a, "nome"));
            case "proj.excluir": ExcluirProjeto(Base(a), Txt(a, "arquivo")); return true;
            case "proj.duplicar": return DuplicarProjeto(Base(a), Txt(a, "arquivo"), Txt(a, "nome"));
            case "foto.lista":
                {
                    string d = PastaFotos(pastaProjetos, Txt(a, "arquivo"));
                    List<string> ids = new List<string>();
                    if (Directory.Exists(d)) foreach (string f in Directory.GetFiles(d, "*.jpg")) ids.Add(Path.GetFileNameWithoutExtension(f));
                    return ids;
                }
            case "foto.gravar":
                {
                    string d = PastaFotos(pastaProjetos, Txt(a, "arquivo"));
                    Directory.CreateDirectory(d);
                    File.WriteAllBytes(Path.Combine(d, Seguro(Txt(a, "id")) + ".jpg"), DeDataUrl(Txt(a, "dados")));
                    return true;
                }
            case "foto.ler":
                {
                    string f = Path.Combine(PastaFotos(pastaProjetos, Txt(a, "arquivo")), Seguro(Txt(a, "id")) + ".jpg");
                    return File.Exists(f) ? "data:image/jpeg;base64," + Convert.ToBase64String(File.ReadAllBytes(f)) : null;
                }
            case "mini.gravar":
                {
                    string f = Miniatura(pastaProjetos, Txt(a, "arquivo"));
                    Directory.CreateDirectory(Path.GetDirectoryName(f));
                    File.WriteAllBytes(f, DeDataUrl(Txt(a, "dados")));
                    return true;
                }
            case "modelo.listar":
                {
                    List<object> l = new List<object>();
                    foreach (string f in Directory.GetFiles(pastaModelos, "*.asa"))
                    {
                        Dictionary<string, object> r = new Dictionary<string, object>();
                        r["arquivo"] = Path.GetFileName(f);
                        r["texto"] = File.ReadAllText(f, Encoding.UTF8);
                        l.Add(r);
                    }
                    return l;
                }
            case "modelo.gravar":
                {
                    string f = Path.Combine(pastaModelos, Seguro(Txt(a, "nome")) + ".asa");
                    GravarAtomico(f, Txt(a, "texto"));
                    return Path.GetFileName(f);
                }
            case "modelo.excluir":
                {
                    string f = Path.Combine(pastaModelos, Path.GetFileName(Txt(a, "arquivo")));
                    if (File.Exists(f)) Lixeira(f);
                    return true;
                }
            case "contexto":
                projetoAtual = Txt(a, "nome");
                if (!string.IsNullOrEmpty(Txt(a, "arquivo"))) proximoArquivo = Txt(a, "arquivo");   // nome com acentos para o próximo arquivo baixado
                return true;
            case "pdf": return await Pdf(Txt(a, "nome"), Txt(a, "titulo"));
            case "pasta.projeto":
                {
                    string d = PastaSaida(Txt(a, "nome"));
                    Abrir(d);
                    return d;
                }
            case "abrir": Abrir(Txt(a, "caminho")); return true;
            case "mostrar":
                {
                    string p = Txt(a, "caminho");
                    if (File.Exists(p)) Process.Start("explorer.exe", "/select,\"" + p + "\"");
                    else Abrir(p);
                    return true;
                }
            case "notificar": Notificar(Txt(a, "titulo"), Txt(a, "texto")); return true;
            case "atualizar": return await Atualizar(Txt(a, "url"), Txt(a, "versao"));
        }
        throw new Exception("comando desconhecido: " + cmd);
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Configurações (a chave do Google fica à parte, protegida pelo Windows para este usuário)
    string ArqConfig { get { return Path.Combine(pastaDados, "config.json"); } }
    string ArqChave { get { return Path.Combine(pastaDados, "chave.bin"); } }

    Dictionary<string, object> LerConfig()
    {
        Dictionary<string, object> c = null;
        try { c = json.DeserializeObject(File.ReadAllText(ArqConfig, Encoding.UTF8)) as Dictionary<string, object>; } catch (Exception) { }
        if (c == null) c = new Dictionary<string, object>();
        try
        {
            if (File.Exists(ArqChave))
                c["chave"] = Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(ArqChave), Encoding.UTF8.GetBytes("Asa"), DataProtectionScope.CurrentUser));
        }
        catch (Exception) { }
        return c;
    }

    void GravarConfig(Dictionary<string, object> novos)
    {
        Dictionary<string, object> c = LerConfig();
        c.Remove("chave");
        foreach (KeyValuePair<string, object> kv in novos)
        {
            if (kv.Key == "chave")
            {
                string k = Convert.ToString(kv.Value) ?? "";
                if (k.Length == 0) { if (File.Exists(ArqChave)) File.Delete(ArqChave); }
                else File.WriteAllBytes(ArqChave, ProtectedData.Protect(Encoding.UTF8.GetBytes(k), Encoding.UTF8.GetBytes("Asa"), DataProtectionScope.CurrentUser));
            }
            else c[kv.Key] = kv.Value;
        }
        GravarAtomico(ArqConfig, json.Serialize(c));
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Projetos: Documentos\Asa\Projetos\<nome>.asa (JSON), as fotos dos takes em <nome>.fotos\ e a miniatura em .miniaturas\
    // Os Locais próximos usam o mesmo esquema, em Documentos\Asa\Locais (pasta:"locais" no comando)
    string Base(Dictionary<string, object> a) { return Txt(a, "pasta") == "locais" ? pastaLocais : pastaProjetos; }
    static string Projeto(string b, string arquivo) { return Path.Combine(b, Path.GetFileName(arquivo)); }
    static string PastaFotos(string b, string arquivo) { return Path.Combine(b, Path.GetFileNameWithoutExtension(arquivo) + ".fotos"); }
    static string Miniatura(string b, string arquivo) { return Path.Combine(b, ".miniaturas", Path.GetFileNameWithoutExtension(arquivo) + ".jpg"); }

    List<object> ListarProjetos(string b)
    {
        List<object> l = new List<object>();
        foreach (string f in Directory.GetFiles(b, "*.asa"))
        {
            Dictionary<string, object> r = new Dictionary<string, object>();
            r["arquivo"] = Path.GetFileName(f);
            r["modificado"] = (File.GetLastWriteTimeUtc(f) - new DateTime(1970, 1, 1)).TotalMilliseconds;
            try { r["texto"] = File.ReadAllText(f, Encoding.UTF8); } catch (Exception) { continue; }
            string mini = Miniatura(b, f);
            if (File.Exists(mini)) r["miniatura"] = "data:image/jpeg;base64," + Convert.ToBase64String(File.ReadAllBytes(mini));
            l.Add(r);
        }
        return l;
    }

    string GravarProjeto(string b, string arquivo, string texto, string nome)
    {
        string alvo = Seguro(string.IsNullOrEmpty(nome) ? "Sem nome" : nome) + ".asa";
        if (string.IsNullOrEmpty(arquivo))
        {
            arquivo = Livre(b, alvo);
        }
        else if (!string.Equals(Path.GetFileName(arquivo), alvo, StringComparison.OrdinalIgnoreCase) && !File.Exists(Projeto(b, alvo)))
        {
            // o nome do empreendimento mudou: o arquivo, as fotos e a miniatura acompanham
            string velho = Projeto(b, arquivo);
            if (File.Exists(velho))
            {
                File.Move(velho, Projeto(b, alvo));
                if (Directory.Exists(PastaFotos(b, arquivo))) Directory.Move(PastaFotos(b, arquivo), PastaFotos(b, alvo));
                if (File.Exists(Miniatura(b, arquivo))) File.Move(Miniatura(b, arquivo), Miniatura(b, alvo));
            }
            arquivo = alvo;
        }
        GravarAtomico(Projeto(b, arquivo), texto);
        return Path.GetFileName(arquivo);
    }

    static string Livre(string b, string nome)
    {
        string r = Path.GetFileNameWithoutExtension(nome), x = Path.GetExtension(nome), n = nome;
        for (int i = 2; File.Exists(Projeto(b, n)); i++) n = r + " (" + i + ")" + x;
        return n;
    }

    void ExcluirProjeto(string b, string arquivo)
    {
        string f = Projeto(b, arquivo);
        if (File.Exists(f)) Lixeira(f);
        if (Directory.Exists(PastaFotos(b, arquivo))) Microsoft.VisualBasic.FileIO.FileSystem.DeleteDirectory(PastaFotos(b, arquivo), Microsoft.VisualBasic.FileIO.UIOption.OnlyErrorDialogs, Microsoft.VisualBasic.FileIO.RecycleOption.SendToRecycleBin);
        if (File.Exists(Miniatura(b, arquivo))) File.Delete(Miniatura(b, arquivo));
    }

    string DuplicarProjeto(string b, string arquivo, string nome)
    {
        Dictionary<string, object> d = json.DeserializeObject(File.ReadAllText(Projeto(b, arquivo), Encoding.UTF8)) as Dictionary<string, object>;
        Dictionary<string, object> p = (d != null && d.ContainsKey("projeto") ? d["projeto"] : d != null && d.ContainsKey("locais") ? d["locais"] : d) as Dictionary<string, object>;
        if (p != null) p["name"] = nome;
        string novo = Livre(b, Seguro(nome) + ".asa");
        GravarAtomico(Projeto(b, novo), json.Serialize(d));
        if (Directory.Exists(PastaFotos(b, arquivo)))
        {
            Directory.CreateDirectory(PastaFotos(b, novo));
            foreach (string f in Directory.GetFiles(PastaFotos(b, arquivo))) File.Copy(f, Path.Combine(PastaFotos(b, novo), Path.GetFileName(f)), true);
        }
        if (File.Exists(Miniatura(b, arquivo))) File.Copy(Miniatura(b, arquivo), Miniatura(b, novo), true);
        return novo;
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Saída: Documentos\Asa\<nome do projeto>\ (PDF, Word e vídeos)
    string PastaSaida(string nome)
    {
        string d = Path.Combine(pastaAsa, Seguro(string.IsNullOrEmpty(nome) ? "Sem nome" : nome));
        Directory.CreateDirectory(d);
        return d;
    }

    async Task<object> Pdf(string nome, string titulo)
    {
        string arq = Path.Combine(PastaSaida(nome), Seguro(string.IsNullOrEmpty(titulo) ? "Plano de Voo - " + nome : titulo) + ".pdf");
        CoreWebView2PrintSettings p = web.CoreWebView2.Environment.CreatePrintSettings();
        p.Orientation = CoreWebView2PrintOrientation.Portrait;
        p.PageWidth = 8.5; p.PageHeight = 11;   // Carta
        p.MarginTop = 0; p.MarginBottom = 0; p.MarginLeft = 0; p.MarginRight = 0;
        p.ShouldPrintBackgrounds = true;
        p.ShouldPrintHeaderAndFooter = false;
        p.ScaleFactor = 1;
        bool ok = await web.CoreWebView2.PrintToPdfAsync(arq, p);
        if (!ok) throw new Exception("o Windows não conseguiu gravar o PDF (o arquivo pode estar aberto em outro programa)");
        return arq;
    }

    void AoBaixar(object s, CoreWebView2DownloadStartingEventArgs e)
    {
        // Word, vídeos e o que mais a página baixar vão direto para a pasta do projeto, sem perguntar
        string nome = Path.GetFileName(e.ResultFilePath);
        if (!string.IsNullOrEmpty(proximoArquivo) && string.Equals(Path.GetExtension(proximoArquivo), Path.GetExtension(nome), StringComparison.OrdinalIgnoreCase))
            nome = Seguro(proximoArquivo);
        proximoArquivo = "";
        string destino = Path.Combine(PastaSaida(projetoAtual), nome);
        e.ResultFilePath = destino;
        e.Handled = true;
        CoreWebView2DownloadOperation op = e.DownloadOperation;
        op.StateChanged += delegate
        {
            Dictionary<string, object> d = new Dictionary<string, object>();
            if (op.State == CoreWebView2DownloadState.Completed) { d["caminho"] = op.ResultFilePath; Evento("baixado", d); }
            else if (op.State == CoreWebView2DownloadState.Interrupted) { d["erro"] = op.InterruptReason.ToString(); Evento("baixado", d); }
        };
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Atualização: baixa o .zip da versão nova (GitHub), espera o Asa fechar, copia por cima e abre de novo
    async Task<object> Atualizar(string url, string versao)
    {
        if (string.IsNullOrEmpty(url) || !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) throw new Exception("endereço inválido");
        string pasta = Path.Combine(pastaDados, "atualizacao");
        if (Directory.Exists(pasta)) Directory.Delete(pasta, true);
        Directory.CreateDirectory(pasta);
        string zip = Path.Combine(pasta, "asa.zip"), novos = Path.Combine(pasta, "arquivos");
        using (HttpClient h = new HttpClient())
        {
            h.DefaultRequestHeaders.UserAgent.ParseAdd("Asa/" + Versao);
            byte[] b = await h.GetByteArrayAsync(url);
            File.WriteAllBytes(zip, b);
        }
        ZipFile.ExtractToDirectory(zip, novos);
        if (!File.Exists(Path.Combine(novos, "Asa.exe"))) throw new Exception("o pacote da versão " + versao + " não tem o Asa.exe");
        string cmd = Path.Combine(pasta, "atualizar.cmd");
        int pid = Process.GetCurrentProcess().Id;
        File.WriteAllText(cmd,
            "@echo off\r\n" +
            ":espera\r\n" +
            "tasklist /fi \"PID eq " + pid + "\" | find \"" + pid + "\" >nul && (timeout /t 1 /nobreak >nul & goto espera)\r\n" +
            "robocopy \"" + novos + "\" \"" + pastaApp + "\" /E /R:5 /W:1 /NFL /NDL /NJH /NJS >nul\r\n" +
            "start \"\" \"" + Path.Combine(pastaApp, "Asa.exe") + "\"\r\n", Encoding.Default);
        ProcessStartInfo si = new ProcessStartInfo("cmd.exe", "/c \"" + cmd + "\"");
        si.WindowStyle = ProcessWindowStyle.Hidden;
        si.CreateNoWindow = true;
        Process.Start(si);
        BeginInvoke(new Action(delegate { Close(); }));
        return true;
    }

    // ---------------------------------------------------------------------------------------------------------------
    void Notificar(string titulo, string texto)
    {
        if (aviso == null)
        {
            aviso = new NotifyIcon();
            aviso.Icon = Icon;
            aviso.Text = "Asa";
            aviso.BalloonTipClicked += delegate { WindowState = FormWindowState.Normal; Activate(); };
        }
        aviso.Visible = true;
        aviso.ShowBalloonTip(10000, titulo, texto, ToolTipIcon.Warning);
    }

    void CriarAtalho()
    {
        // um atalho no menu Iniciar, na primeira vez (e quando o Asa muda de pasta)
        try
        {
            string lnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Asa.lnk");
            string marca = Path.Combine(pastaDados, "atalho.txt");
            if (File.Exists(lnk) && File.Exists(marca) && File.ReadAllText(marca) == Application.ExecutablePath) return;
            Type t = Type.GetTypeFromProgID("WScript.Shell");
            object sh = Activator.CreateInstance(t);
            object at = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, sh, new object[] { lnk });
            Type ta = at.GetType();
            ta.InvokeMember("TargetPath", BindingFlags.SetProperty, null, at, new object[] { Application.ExecutablePath });
            ta.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, at, new object[] { pastaApp });
            ta.InvokeMember("Description", BindingFlags.SetProperty, null, at, new object[] { "Asa: assistente de tour" });
            ta.InvokeMember("Save", BindingFlags.InvokeMethod, null, at, null);
            File.WriteAllText(marca, Application.ExecutablePath);
        }
        catch (Exception) { }
    }

    // ---------------------------------------------------------------------------------------------------------------
    // Posição da janela: abre onde estava da última vez
    string ArqJanela { get { return Path.Combine(pastaDados, "janela.json"); } }

    void RestaurarPosicao()
    {
        Rectangle area = Screen.PrimaryScreen.WorkingArea;
        Bounds = new Rectangle(area.X + area.Width / 12, area.Y + area.Height / 12, area.Width * 5 / 6, area.Height * 5 / 6);
        try
        {
            Dictionary<string, object> j = json.DeserializeObject(File.ReadAllText(ArqJanela)) as Dictionary<string, object>;
            Rectangle r = new Rectangle(Convert.ToInt32(j["x"]), Convert.ToInt32(j["y"]), Convert.ToInt32(j["w"]), Convert.ToInt32(j["h"]));
            foreach (Screen t in Screen.AllScreens)
                if (t.WorkingArea.IntersectsWith(r)) { Bounds = r; break; }
            if (Convert.ToBoolean(j["max"])) WindowState = FormWindowState.Maximized;
        }
        catch (Exception) { WindowState = FormWindowState.Maximized; }
    }

    void GuardarPosicao()
    {
        try
        {
            Rectangle r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            Dictionary<string, object> j = new Dictionary<string, object>();
            j["x"] = r.X; j["y"] = r.Y; j["w"] = r.Width; j["h"] = r.Height; j["max"] = WindowState == FormWindowState.Maximized;
            File.WriteAllText(ArqJanela, json.Serialize(j));
        }
        catch (Exception) { }
    }

    // ---------------------------------------------------------------------------------------------------------------
    static string Txt(Dictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) && v != null ? Convert.ToString(v) : ""; }

    static string Seguro(string nome)
    {
        StringBuilder b = new StringBuilder();
        foreach (char ch in (nome ?? "").Trim()) b.Append(Array.IndexOf(Path.GetInvalidFileNameChars(), ch) >= 0 ? '-' : ch);
        string s = b.ToString().Trim().TrimEnd('.');
        if (s.Length > 90) s = s.Substring(0, 90).Trim();
        return s.Length == 0 ? "Sem nome" : s;
    }

    static byte[] DeDataUrl(string d)
    {
        int i = d.IndexOf(',');
        return Convert.FromBase64String(i >= 0 ? d.Substring(i + 1) : d);
    }

    static void GravarAtomico(string arq, string texto)
    {
        string tmp = arq + ".gravando";
        File.WriteAllText(tmp, texto, new UTF8Encoding(false));
        if (File.Exists(arq)) File.Replace(tmp, arq, null); else File.Move(tmp, arq);
    }

    static void Lixeira(string arq)
    {
        Microsoft.VisualBasic.FileIO.FileSystem.DeleteFile(arq, Microsoft.VisualBasic.FileIO.UIOption.OnlyErrorDialogs, Microsoft.VisualBasic.FileIO.RecycleOption.SendToRecycleBin);
    }

    static void Abrir(string alvo)
    {
        try { Process.Start(new ProcessStartInfo(alvo) { UseShellExecute = true }); } catch (Exception) { }
    }
}
