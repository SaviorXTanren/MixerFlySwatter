using Mixer.Base;
using Mixer.Base.Clients;
using Mixer.Base.Model.Channel;
using Mixer.Base.Model.Interactive;
using Mixer.Base.Model.User;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace FlySwatterServer
{
    public static class Program
    {
        private const int GameVersionID = 301323;
        private const string GameShareCode = "5b11a82j";

        private static InteractiveClient interactiveClient;

        private static Dictionary<string, InteractiveParticipantModel> participants = new Dictionary<string, InteractiveParticipantModel>();

        private static Dictionary<string, int> userTotals = new Dictionary<string, int>();

        public static void Main(string[] args)
        {
            Task.Run(async () =>
            {
                List<OAuthClientScopeEnum> scopes = new List<OAuthClientScopeEnum>()
            {
                OAuthClientScopeEnum.channel__details__self,
                OAuthClientScopeEnum.channel__update__self,

                OAuthClientScopeEnum.interactive__manage__self,
                OAuthClientScopeEnum.interactive__robot__self,

                OAuthClientScopeEnum.user__details__self,
                OAuthClientScopeEnum.user__log__self,
                OAuthClientScopeEnum.user__notification__self,
                OAuthClientScopeEnum.user__update__self,
            };

                MixerConnection connection = await MixerConnection.ConnectViaLocalhostOAuthBrowser("ba911f5e09c2d3a87b715e0371f1e9ba96d476b5a7b26ba0", scopes);

                if (connection != null)
                {
                    System.Console.WriteLine("Mixer connection successful!");

                    UserModel user = await connection.Users.GetCurrentUser();
                    ExpandedChannelModel channel = await connection.Channels.GetChannel(user.username);
                    System.Console.WriteLine(string.Format("Logged in as: {0}", user.username));

                    InteractiveGameVersionModel version = await connection.Interactive.GetInteractiveGameVersion(Program.GameVersionID);
                    if (version != null)
                    {
                        InteractiveGameModel game = await connection.Interactive.GetInteractiveGame(version.gameId);
                        if (game != null)
                        {
                            System.Console.WriteLine();
                            System.Console.WriteLine(string.Format("Connecting to channel interactive using game {0}...", game.name));

                            Program.interactiveClient = await InteractiveClient.CreateFromChannel(connection, channel, game, version, Program.GameShareCode);

                            Program.interactiveClient.OnDisconnectOccurred += InteractiveClient_OnDisconnectOccurred;
                            Program.interactiveClient.OnParticipantJoin += InteractiveClient_OnParticipantJoin;
                            Program.interactiveClient.OnParticipantLeave += InteractiveClient_OnParticipantLeave;
                            Program.interactiveClient.OnGiveInput += InteractiveClient_OnGiveInput;

                            if (await Program.interactiveClient.Connect() && await Program.interactiveClient.Ready())
                            {
                                InteractiveConnectedSceneGroupCollectionModel scenes = await Program.interactiveClient.GetScenes();
                                if (scenes != null)
                                {
                                    InteractiveConnectedSceneModel scene = scenes.scenes.First();

                                    InteractiveConnectedButtonControlModel gameStartButton = scene.buttons.First(b => b.controlID.Equals("gameStart"));
                                    InteractiveConnectedButtonControlModel resultsButton = scene.buttons.First(b => b.controlID.Equals("results"));

                                    InteractiveParticipantCollectionModel participantCollection = await Program.interactiveClient.GetAllParticipants(DateTimeOffset.Now.Subtract(TimeSpan.FromMinutes(5)));
                                    if (participantCollection != null && participantCollection.participants != null)
                                    {
                                        foreach (InteractiveParticipantModel participant in participantCollection.participants)
                                        {
                                            Program.participants[participant.sessionID] = participant;
                                        }
                                    }

                                    while (true)
                                    {
                                        try
                                        {
                                            System.Console.WriteLine("Starting new game...");

                                            userTotals.Clear();

                                            await Program.interactiveClient.UpdateControls(scene, new List<InteractiveControlModel>() { gameStartButton });

                                            await Task.Delay(33000);

                                            System.Console.WriteLine("Game completed, selecting winner...");

                                            InteractiveParticipantModel winner = null;
                                            foreach (var kvp in userTotals.OrderBy(kvp => kvp.Value))
                                            {
                                                if (Program.participants.TryGetValue(kvp.Key, out winner))
                                                {
                                                    resultsButton.meta["winner"] = JObject.FromObject(winner);
                                                    await Program.interactiveClient.UpdateControls(scene, new List<InteractiveControlModel>() { resultsButton });
                                                }
                                            }

                                            if (winner != null)
                                            {
                                                System.Console.WriteLine("Winner: " + winner.username);
                                            }

                                            await Task.Delay(5000);
                                        }
                                        catch (Exception ex) { System.Console.WriteLine(ex.ToString()); }
                                    }
                                }
                            }
                        }
                    }
                }
            }).Wait();
        }

        private static async void InteractiveClient_OnDisconnectOccurred(object sender, System.Net.WebSockets.WebSocketCloseStatus e)
        {
            try
            {
                System.Console.WriteLine("Disconnection Occurred, attempting reconnection...");

                do
                {
                    await Program.interactiveClient.Disconnect();

                    await Task.Delay(2500);
                }
                while (!await Program.interactiveClient.Connect() && !await Program.interactiveClient.Ready());

                System.Console.WriteLine("Reconnection successful");
            }
            catch (Exception ex) { System.Console.WriteLine(ex.ToString()); }
        }

        private static void InteractiveClient_OnParticipantJoin(object sender, InteractiveParticipantCollectionModel e)
        {
            try
            {
                if (e.participants != null)
                {
                    foreach (InteractiveParticipantModel participant in e.participants)
                    {
                        Program.participants[participant.sessionID] = participant;
                        System.Console.WriteLine("Participant Joined: " + participant.username);
                    }
                }
            }
            catch (Exception ex) { System.Console.WriteLine(ex.ToString()); }
        }

        private static void InteractiveClient_OnParticipantLeave(object sender, InteractiveParticipantCollectionModel e)
        {
            try
            {
                if (e.participants != null)
                {
                    foreach (InteractiveParticipantModel participant in e.participants)
                    {
                        Program.participants.Remove(participant.sessionID);
                        System.Console.WriteLine("Participant Left: " + participant.username);
                    }
                }
            }
            catch (Exception ex) { System.Console.WriteLine(ex.ToString()); }
        }

        private static void InteractiveClient_OnGiveInput(object sender, InteractiveGiveInputModel e)
        {
            try
            {
                System.Console.WriteLine("Input Received: " + e.participantID + " - " + e.input.controlID);

                if (e.input != null && e.input.controlID != null && e.input.controlID.Equals("gameEnd") && e.input.meta.TryGetValue("total", out JToken totalToken))
                {
                    int total = totalToken.ToObject<int>();
                    if (Program.participants.TryGetValue(e.participantID, out InteractiveParticipantModel participant))
                    {
                        userTotals[participant.sessionID] = total;
                    }
                }
            }
            catch (Exception ex) { System.Console.WriteLine(ex.ToString()); }
        }
    }
}
