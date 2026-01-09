import { beforeEach, describe, expect, it } from "bun:test";
import { useTerminalProfiles } from "../index";

describe("useTerminalProfiles store", () => {
  beforeEach(() => {
    useTerminalProfiles.setState({
      profiles: [
        {
          id: "local-default",
          name: "Local",
          type: "local",
          shell: "zsh",
          isDefault: true,
        },
      ],
    });
  });

  describe("initial state", () => {
    it("has default local profile", () => {
      const { profiles } = useTerminalProfiles.getState();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]?.type).toBe("local");
      expect(profiles[0]?.isDefault).toBe(true);
    });
  });

  describe("addProfile", () => {
    it("adds a local profile", () => {
      const { addProfile } = useTerminalProfiles.getState();

      const newProfile = addProfile({
        name: "Bash Shell",
        type: "local",
        shell: "bash",
      });

      const { profiles } = useTerminalProfiles.getState();
      expect(profiles).toHaveLength(2);
      expect(newProfile.id).toBeDefined();
      expect(newProfile.name).toBe("Bash Shell");
      expect(newProfile.shell).toBe("bash");
    });

    it("adds an SSH profile with all fields", () => {
      const { addProfile } = useTerminalProfiles.getState();

      const newProfile = addProfile({
        name: "Dev Server",
        type: "ssh",
        host: "dev.example.com",
        port: 2222,
        username: "admin",
      });

      expect(newProfile.type).toBe("ssh");
      expect(newProfile.host).toBe("dev.example.com");
      expect(newProfile.port).toBe(2222);
      expect(newProfile.username).toBe("admin");
    });

    it("adds a Docker profile", () => {
      const { addProfile } = useTerminalProfiles.getState();

      const newProfile = addProfile({
        name: "Docker: app",
        type: "docker",
        container: "my-app-container",
      });

      expect(newProfile.type).toBe("docker");
      expect(newProfile.container).toBe("my-app-container");
    });

    it("generates unique IDs for profiles", () => {
      const { addProfile } = useTerminalProfiles.getState();

      const profile1 = addProfile({ name: "Profile 1", type: "local" });
      const profile2 = addProfile({ name: "Profile 2", type: "local" });

      expect(profile1.id).not.toBe(profile2.id);
    });
  });

  describe("updateProfile", () => {
    it("updates profile name", () => {
      const { addProfile, updateProfile } = useTerminalProfiles.getState();
      const profile = addProfile({ name: "Old Name", type: "local" });

      updateProfile(profile.id, { name: "New Name" });

      const { profiles } = useTerminalProfiles.getState();
      const updated = profiles.find((p) => p.id === profile.id);
      expect(updated?.name).toBe("New Name");
    });

    it("updates SSH connection details", () => {
      const { addProfile, updateProfile } = useTerminalProfiles.getState();
      const profile = addProfile({
        name: "SSH",
        type: "ssh",
        host: "old.example.com",
        port: 22,
      });

      updateProfile(profile.id, { host: "new.example.com", port: 2222 });

      const { profiles } = useTerminalProfiles.getState();
      const updated = profiles.find((p) => p.id === profile.id);
      expect(updated?.host).toBe("new.example.com");
      expect(updated?.port).toBe(2222);
    });

    it("preserves unchanged fields", () => {
      const { addProfile, updateProfile } = useTerminalProfiles.getState();
      const profile = addProfile({
        name: "Full SSH",
        type: "ssh",
        host: "host.com",
        port: 22,
        username: "user",
      });

      updateProfile(profile.id, { port: 2222 });

      const { profiles } = useTerminalProfiles.getState();
      const updated = profiles.find((p) => p.id === profile.id);
      expect(updated?.host).toBe("host.com");
      expect(updated?.username).toBe("user");
      expect(updated?.port).toBe(2222);
    });

    it("ignores non-existent profile ID", () => {
      const { updateProfile } = useTerminalProfiles.getState();
      const initialProfiles = useTerminalProfiles.getState().profiles;

      updateProfile("non-existent-id", { name: "Updated" });

      const { profiles } = useTerminalProfiles.getState();
      expect(profiles).toEqual(initialProfiles);
    });
  });

  describe("deleteProfile", () => {
    it("deletes a non-default profile", () => {
      const { addProfile, deleteProfile } = useTerminalProfiles.getState();
      const profile = addProfile({ name: "To Delete", type: "local" });

      deleteProfile(profile.id);

      const { profiles } = useTerminalProfiles.getState();
      expect(profiles.find((p) => p.id === profile.id)).toBeUndefined();
    });

    it("prevents deleting default profile", () => {
      const { profiles: initialProfiles, deleteProfile } =
        useTerminalProfiles.getState();
      const defaultProfile = initialProfiles.find((p) => p.isDefault);

      if (defaultProfile) {
        deleteProfile(defaultProfile.id);
      }

      const { profiles } = useTerminalProfiles.getState();
      expect(profiles.find((p) => p.isDefault)).toBeDefined();
    });

    it("ignores non-existent profile ID", () => {
      const { deleteProfile } = useTerminalProfiles.getState();
      const initialCount = useTerminalProfiles.getState().profiles.length;

      deleteProfile("non-existent-id");

      const { profiles } = useTerminalProfiles.getState();
      expect(profiles.length).toBe(initialCount);
    });
  });

  describe("setDefault", () => {
    it("sets a profile as default", () => {
      const { addProfile, setDefault } = useTerminalProfiles.getState();
      const newProfile = addProfile({ name: "New Default", type: "local" });

      setDefault(newProfile.id);

      const { profiles } = useTerminalProfiles.getState();
      const newDefault = profiles.find((p) => p.id === newProfile.id);
      const oldDefault = profiles.find((p) => p.id === "local-default");
      expect(newDefault?.isDefault).toBe(true);
      expect(oldDefault?.isDefault).toBe(false);
    });

    it("ensures only one default exists", () => {
      const { addProfile, setDefault } = useTerminalProfiles.getState();
      addProfile({ name: "Profile 1", type: "local" });
      const profile2 = addProfile({ name: "Profile 2", type: "local" });

      setDefault(profile2.id);

      const { profiles } = useTerminalProfiles.getState();
      const defaults = profiles.filter((p) => p.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0]?.id).toBe(profile2.id);
    });
  });

  describe("getDefault", () => {
    it("returns the default profile", () => {
      const { getDefault } = useTerminalProfiles.getState();

      const defaultProfile = getDefault();

      expect(defaultProfile.isDefault).toBe(true);
      expect(defaultProfile.id).toBe("local-default");
    });

    it("returns first profile if no default is set", () => {
      useTerminalProfiles.setState({
        profiles: [
          { id: "p1", name: "Profile 1", type: "local" },
          { id: "p2", name: "Profile 2", type: "local" },
        ],
      });

      const { getDefault } = useTerminalProfiles.getState();
      const result = getDefault();

      expect(result.id).toBe("p1");
    });

    it("returns fallback when profiles array is empty", () => {
      useTerminalProfiles.setState({ profiles: [] });

      const { getDefault } = useTerminalProfiles.getState();
      const result = getDefault();

      expect(result).toBeDefined();
      expect(result.type).toBe("local");
    });
  });

  describe("profile types", () => {
    it("supports all profile type fields", () => {
      const { addProfile } = useTerminalProfiles.getState();

      const localProfile = addProfile({
        name: "Local",
        type: "local",
        shell: "/bin/zsh",
        cwd: "/home/user",
      });

      const sshProfile = addProfile({
        name: "SSH",
        type: "ssh",
        host: "server.com",
        port: 22,
        username: "admin",
        cwd: "/var/www",
      });

      const dockerProfile = addProfile({
        name: "Docker",
        type: "docker",
        container: "my-container",
        cwd: "/app",
      });

      expect(localProfile.shell).toBe("/bin/zsh");
      expect(localProfile.cwd).toBe("/home/user");
      expect(sshProfile.host).toBe("server.com");
      expect(sshProfile.port).toBe(22);
      expect(sshProfile.username).toBe("admin");
      expect(dockerProfile.container).toBe("my-container");
    });
  });
});
