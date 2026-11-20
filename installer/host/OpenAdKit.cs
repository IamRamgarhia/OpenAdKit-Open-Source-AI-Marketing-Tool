// OpenAdKit desktop window (Windows).
//
// A small WinForms + WebView2 shell around the local server:
//   1. picks (and remembers) a stable port pair under %LOCALAPPDATA%\OpenAdKit
//   2. starts  node\node.exe app\scripts\local-sync.cjs  (the sidecar, which
//      starts the production web server app\server.js)
//   3. shows the app in a WebView2 window once it answers
//   4. on close, asks the sidecar to quit; a Job Object guarantees node dies
//      with this process even if it crashes
//
// Ports MUST stay stable: browser storage (API keys, clients, history) is
// keyed by origin, and the port is part of the origin.
//
// Built with the C# compiler that ships with Windows (.NET Framework 4,
// C# 5 language level) by scripts/build-windows-installer.cjs — so no .NET
// SDK is needed and nothing newer than C# 5 may be used here.
//
// Exit codes for --self-test: 0 ok, 2 files missing, 3 WebView2 missing.

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: System.Reflection.AssemblyTitle("OpenAdKit")]
[assembly: System.Reflection.AssemblyProduct("OpenAdKit")]
[assembly: System.Reflection.AssemblyCompany("DiceCodes")]
[assembly: System.Reflection.AssemblyCopyright("DiceCodes - MIT licensed")]

namespace OpenAdKit
{
    static class Program
    {
        public const string AppName = "OpenAdKit";
        const string MutexName = "Local\\OpenAdKit_SingleInstance_7F3A";
        const string ShowEventName = "Local\\OpenAdKit_ShowWindow_7F3A";

        [STAThread]
        static int Main(string[] args)
        {
            foreach (string a in args)
            {
                if (a == "--self-test") return SelfTest();
            }

            bool createdNew;
            using (Mutex mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew)
                {
                    // Already running: ask the existing window to come forward.
                    try
                    {
                        EventWaitHandle ev = EventWaitHandle.OpenExisting(ShowEventName);
                        ev.Set();
                    }
                    catch (Exception) { }
                    return 0;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                EventWaitHandle show = new EventWaitHandle(false, EventResetMode.AutoReset, ShowEventName);
                MainForm form = new MainForm(show);
                Application.Run(form);
                return 0;
            }
        }

        public static string AppDir
        {
            get { return Path.GetDirectoryName(Application.ExecutablePath); }
        }

        public static string DataDir
        {
            get
            {
                string d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppName);
                Directory.CreateDirectory(d);
                return d;
            }
        }

        public static string NodeExe { get { return Path.Combine(AppDir, "node", "node.exe"); } }
        public static string Sidecar { get { return Path.Combine(AppDir, "app", "scripts", "local-sync.cjs"); } }
        public static string ServerJs { get { return Path.Combine(AppDir, "app", "server.js"); } }
        public static string BuildId { get { return Path.Combine(AppDir, "app", ".next", "BUILD_ID"); } }

        public static string WebView2Version()
        {
            try { return CoreWebView2Environment.GetAvailableBrowserVersionString(); }
            catch (Exception) { return null; }
        }

        static int SelfTest()
        {
            string[] needed = new string[] { NodeExe, Sidecar, ServerJs, BuildId };
            foreach (string f in needed)
            {
                if (!File.Exists(f)) { Console.Error.WriteLine("missing: " + f); return 2; }
            }
            string wv = WebView2Version();
            if (string.IsNullOrEmpty(wv)) { Console.Error.WriteLine("WebView2 runtime not found"); return 3; }
            Console.WriteLine("ok (WebView2 " + wv + ")");
            return 0;
        }
    }

    /// Stable port pair, persisted in %LOCALAPPDATA%\OpenAdKit\ports.txt.
    static class Ports
    {
        public static bool IsFree(int port)
        {
            TcpListener l = null;
            try
            {
                l = new TcpListener(IPAddress.Loopback, port);
                l.Start();
                return true;
            }
            catch (SocketException) { return false; }
            finally { if (l != null) l.Stop(); }
        }

        public static void Resolve(out int web, out int sync)
        {
            string file = Path.Combine(Program.DataDir, "ports.txt");
            web = 0; sync = 0;
            try
            {
                if (File.Exists(file))
                {
                    string[] parts = File.ReadAllText(file).Trim().Split(',');
                    if (parts.Length == 2)
                    {
                        web = int.Parse(parts[0]);
                        sync = int.Parse(parts[1]);
                    }
                }
            }
            catch (Exception) { web = 0; sync = 0; }

            if (web > 0 && sync > 0 && IsFree(web) && IsFree(sync)) return;

            // First run, or the saved pair is taken by something else. Walk the
            // rarely-used 41573+ range in pairs (same range as resolve-ports.cjs).
            for (int p = 41573; p < 49990; p += 2)
            {
                if (IsFree(p) && IsFree(p + 1))
                {
                    web = p; sync = p + 1;
                    File.WriteAllText(file, web + "," + sync);
                    return;
                }
            }
            throw new Exception("No free local port pair found between 41573 and 49990.");
        }
    }

    /// Kill-on-close Job Object: every process assigned to it (node and the
    /// server it spawns) dies when this host exits, even after a crash.
    static class Job
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        static extern IntPtr CreateJobObject(IntPtr a, string name);
        [DllImport("kernel32.dll")]
        static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint len);
        [DllImport("kernel32.dll")]
        static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

        [StructLayout(LayoutKind.Sequential)]
        struct BASIC_LIMIT
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct IO_COUNTERS
        {
            public ulong a, b, c, d, e, f;
        }
        [StructLayout(LayoutKind.Sequential)]
        struct EXTENDED_LIMIT
        {
            public BASIC_LIMIT Basic;
            public IO_COUNTERS Io;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        static IntPtr handle = IntPtr.Zero;

        public static void Add(Process p)
        {
            try
            {
                if (handle == IntPtr.Zero)
                {
                    handle = CreateJobObject(IntPtr.Zero, null);
                    EXTENDED_LIMIT info = new EXTENDED_LIMIT();
                    info.Basic.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                    int len = Marshal.SizeOf(typeof(EXTENDED_LIMIT));
                    IntPtr ptr = Marshal.AllocHGlobal(len);
                    Marshal.StructureToPtr(info, ptr, false);
                    SetInformationJobObject(handle, 9, ptr, (uint)len); // ExtendedLimitInformation
                    Marshal.FreeHGlobal(ptr);
                }
                AssignProcessToJobObject(handle, p.Handle);
            }
            catch (Exception) { /* best effort; Quit() still stops the server */ }
        }
    }

    class MainForm : Form
    {
        readonly EventWaitHandle showSignal;
        readonly Label status;
        WebView2 web;
        Process node;
        int webPort, syncPort;
        string logPath;
        StreamWriter log;
        bool quitting;

        public MainForm(EventWaitHandle show)
        {
            showSignal = show;
            Text = Program.AppName;
            Width = 1360; Height = 880;
            MinimumSize = new Size(900, 600);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(8, 8, 10);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }

            status = new Label();
            status.Dock = DockStyle.Fill;
            status.TextAlign = ContentAlignment.MiddleCenter;
            status.ForeColor = Color.FromArgb(231, 231, 234);
            status.Font = new Font("Segoe UI", 12f);
            status.Text = "Starting OpenAdKit…";
            Controls.Add(status);

            Load += OnLoad;
            FormClosing += OnClosing;

            // Bring this window forward when a second launch signals us.
            Thread t = new Thread(delegate ()
            {
                while (true)
                {
                    showSignal.WaitOne();
                    try
                    {
                        BeginInvoke((MethodInvoker)delegate ()
                        {
                            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
                            Activate();
                        });
                    }
                    catch (Exception) { return; }
                }
            });
            t.IsBackground = true;
            t.Start();
        }

        void Status(string s)
        {
            if (InvokeRequired) { BeginInvoke((MethodInvoker)delegate () { Status(s); }); return; }
            status.Text = s;
        }

        void OnLoad(object sender, EventArgs e)
        {
            try
            {
                if (!File.Exists(Program.NodeExe) || !File.Exists(Program.Sidecar) || !File.Exists(Program.BuildId))
                {
                    Fail("OpenAdKit's files are incomplete. Please reinstall it.");
                    return;
                }
                Ports.Resolve(out webPort, out syncPort);
                StartServer();
                Thread wait = new Thread(WaitForServer);
                wait.IsBackground = true;
                wait.Start();
            }
            catch (Exception ex)
            {
                Fail("OpenAdKit could not start: " + ex.Message);
            }
        }

        void StartServer()
        {
            string logDir = Path.Combine(Program.DataDir, "logs");
            Directory.CreateDirectory(logDir);
            logPath = Path.Combine(logDir, "server.log");
            log = new StreamWriter(logPath, false, new UTF8Encoding(false));
            log.AutoFlush = true;

            ProcessStartInfo psi = new ProcessStartInfo(Program.NodeExe, "\"" + Program.Sidecar + "\"");
            psi.WorkingDirectory = Path.Combine(Program.AppDir, "app");
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            // Node writes UTF-8; without this the log reads it as the OEM code page.
            psi.StandardOutputEncoding = Encoding.UTF8;
            psi.StandardErrorEncoding = Encoding.UTF8;
            psi.EnvironmentVariables["PORT"] = webPort.ToString();
            psi.EnvironmentVariables["OPENADKIT_SYNC_PORT"] = syncPort.ToString();
            psi.EnvironmentVariables["ADFORGE_SYNC_PORT"] = syncPort.ToString();
            // The sidecar's data folder (snapshot of clients/history) is left at
            // its default, %APPDATA%\OpenAdKit, so a source install and this
            // packaged app share the same saved data. Only the window cache,
            // ports and logs live under %LOCALAPPDATA%\OpenAdKit.
            psi.EnvironmentVariables["OPENADKIT_PACKAGED"] = "windows";
            psi.EnvironmentVariables["NODE_ENV"] = "production";

            node = new Process();
            node.StartInfo = psi;
            node.EnableRaisingEvents = true;
            node.Exited += OnNodeExited;
            node.OutputDataReceived += delegate (object s, DataReceivedEventArgs a) { WriteLog(a.Data); };
            node.ErrorDataReceived += delegate (object s, DataReceivedEventArgs a) { WriteLog(a.Data); };
            node.Start();
            Job.Add(node);
            node.BeginOutputReadLine();
            node.BeginErrorReadLine();
        }

        /// The sidecar exits after downloading a verified update (POST
        /// /release/apply writes update/ready.json first). Run that Setup
        /// silently and close, so Setup can replace this exe; Setup reopens
        /// OpenAdKit when it finishes (/RELAUNCH).
        void OnNodeExited(object sender, EventArgs e)
        {
            if (quitting) return;
            string dir = Path.Combine(Program.DataDir, "update");
            string ready = Path.Combine(dir, "ready.json");
            string setup = Path.Combine(dir, "OpenAdKit-Windows-Setup.exe");
            if (!File.Exists(ready) || !File.Exists(setup)) return;
            try
            {
                File.Delete(ready);
                ProcessStartInfo si = new ProcessStartInfo(setup, "/SILENT /SUPPRESSMSGBOXES /NORESTART /RELAUNCH");
                si.UseShellExecute = true;
                Process.Start(si);
                quitting = true;
                BeginInvoke((MethodInvoker)delegate () { Application.Exit(); });
            }
            catch (Exception ex)
            {
                WriteLog("Could not start the update: " + ex.Message);
                Status("The update could not start. Download it from github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool/releases");
            }
        }

        void WriteLog(string line)
        {
            if (line == null) return;
            try { lock (this) { if (log != null) log.WriteLine(line); } } catch (Exception) { }
        }

        static bool Answers(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 1500;
                req.Proxy = null;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return (int)res.StatusCode < 500;
                }
            }
            catch (WebException ex)
            {
                HttpWebResponse r = ex.Response as HttpWebResponse;
                return r != null && (int)r.StatusCode < 500;
            }
            catch (Exception) { return false; }
        }

        void WaitForServer()
        {
            string url = "http://127.0.0.1:" + webPort + "/";
            DateTime deadline = DateTime.UtcNow.AddSeconds(60);
            while (DateTime.UtcNow < deadline)
            {
                if (node == null || node.HasExited)
                {
                    Fail("OpenAdKit's server stopped while starting. Details are in:\n" + logPath);
                    return;
                }
                if (Answers(url))
                {
                    BeginInvoke((MethodInvoker)delegate () { ShowApp(url); });
                    return;
                }
                Thread.Sleep(300);
            }
            Fail("OpenAdKit did not start within 60 seconds. Details are in:\n" + logPath);
        }

        async void ShowApp(string url)
        {
            if (string.IsNullOrEmpty(Program.WebView2Version()))
            {
                // No WebView2 runtime: keep running and use the default browser.
                Status("OpenAdKit is running in your web browser.\n\nKeep this window open while you use it;\nclose it to stop OpenAdKit.");
                OpenExternal(url);
                return;
            }
            try
            {
                web = new WebView2();
                web.Dock = DockStyle.Fill;
                web.DefaultBackgroundColor = Color.FromArgb(8, 8, 10);
                Controls.Add(web);
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(
                    null, Path.Combine(Program.DataDir, "webview"), null);
                await web.EnsureCoreWebView2Async(env);
                web.CoreWebView2.Settings.IsStatusBarEnabled = false;
                web.CoreWebView2.NewWindowRequested += delegate (object s, CoreWebView2NewWindowRequestedEventArgs a)
                {
                    // target=_blank links (provider dashboards, docs) open in the real browser.
                    a.Handled = true;
                    OpenExternal(a.Uri);
                };
                string origin = "http://127.0.0.1:" + webPort;
                web.CoreWebView2.NavigationStarting += delegate (object s, CoreWebView2NavigationStartingEventArgs a)
                {
                    if (!a.Uri.StartsWith(origin) && !a.Uri.StartsWith("about:"))
                    {
                        a.Cancel = true;
                        OpenExternal(a.Uri);
                    }
                };
                web.CoreWebView2.Navigate(url);
                status.Visible = false;
                web.BringToFront();
            }
            catch (Exception ex)
            {
                WriteLog("WebView2 failed: " + ex);
                Status("OpenAdKit is running in your web browser.\n\nKeep this window open while you use it;\nclose it to stop OpenAdKit.");
                OpenExternal(url);
            }
        }

        static void OpenExternal(string url)
        {
            if (string.IsNullOrEmpty(url)) return;
            if (!(url.StartsWith("http://") || url.StartsWith("https://") || url.StartsWith("mailto:"))) return;
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch (Exception) { }
        }

        void Fail(string message)
        {
            Status(message);
        }

        void OnClosing(object sender, FormClosingEventArgs e)
        {
            if (quitting) return;
            quitting = true;
            // Polite stop first so the sidecar flushes the snapshot and stops
            // the web server; the Job Object is the backstop.
            try
            {
                if (syncPort > 0)
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + syncPort + "/quit");
                    req.Method = "POST";
                    req.Timeout = 2000;
                    req.Proxy = null;
                    req.ContentLength = 0;
                    using (req.GetResponse()) { }
                }
            }
            catch (Exception) { }
            try
            {
                if (node != null && !node.HasExited && !node.WaitForExit(4000)) node.Kill();
            }
            catch (Exception) { }
            try { lock (this) { if (log != null) { log.Dispose(); log = null; } } } catch (Exception) { }
        }
    }
}
