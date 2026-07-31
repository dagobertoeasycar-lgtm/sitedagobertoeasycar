using System;
using System.IO;
using System.Net.Sockets;
using System.Text;

internal static class Healthcheck
{
    private const string LogFile = @"C:\Logs\DagobertoEasycar\healthcheck.log";
    private const string StateFile = @"C:\Logs\DagobertoEasycar\healthcheck-state.log";

    private static bool Check(int port, string host)
    {
        try
        {
            using (var client = new TcpClient())
            {
                var pending = client.BeginConnect("127.0.0.1", port, null, null);
                if (!pending.AsyncWaitHandle.WaitOne(5000)) return false;
                client.EndConnect(pending);
                client.ReceiveTimeout = 8000;
                client.SendTimeout = 8000;
                using (var stream = client.GetStream())
                {
                    var request = Encoding.ASCII.GetBytes("GET /api/health HTTP/1.1\r\nHost: " + host + "\r\nConnection: close\r\n\r\n");
                    stream.Write(request, 0, request.Length);
                    using (var reader = new StreamReader(stream, Encoding.UTF8))
                    {
                        var body = reader.ReadToEnd();
                        return body.Contains(" 200 OK")
                            && body.Contains("\"status\":\"ok\"")
                            && body.Contains("\"database\":\"ok\"");
                    }
                }
            }
        }
        catch { return false; }
    }

    public static int Main()
    {
        File.WriteAllText(StateFile, DateTimeOffset.Now.ToString("o") + " START");
        var direct = Check(3100, "127.0.0.1");
        File.WriteAllText(StateFile, DateTimeOffset.Now.ToString("o") + " DIRECT=" + direct);
        var iis = Check(80, "www.dagobertoeasycar.com.br");
        File.WriteAllText(StateFile, DateTimeOffset.Now.ToString("o") + " IIS=" + iis);
        var ok = direct && iis;
        Directory.CreateDirectory(Path.GetDirectoryName(LogFile));
        File.AppendAllText(LogFile, DateTimeOffset.Now.ToString("o") + (ok ? " OK exe" : " FALHA exe") + Environment.NewLine);
        return ok ? 0 : 1;
    }
}
