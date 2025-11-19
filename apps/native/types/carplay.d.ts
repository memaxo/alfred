declare module "@g4rb4g3/react-native-carplay" {
  type VoiceControlTemplateConfig = {
    title: string;
    subtitle?: string;
    buttons?: unknown[];
  };

  type VoiceControlButtonConfig = {
    id: string;
    onPress: () => void | Promise<void>;
  };

  type VoiceControlTemplateCtor = new (
    config: VoiceControlTemplateConfig
  ) => unknown;

  type VoiceControlButtonCtor = new (
    config: VoiceControlButtonConfig
  ) => unknown;

  type CarPlayApi = {
    registerOnConnect?(handler: () => void): void;
    VoiceControlTemplate?: VoiceControlTemplateCtor;
    VoiceControlButton?: VoiceControlButtonCtor;
    CarPlayButton?: VoiceControlButtonCtor;
    pushTemplate?(template: unknown, animated: boolean): void;
    connected?: boolean;
  };

  const CarPlay: CarPlayApi;
  export default CarPlay;
}
