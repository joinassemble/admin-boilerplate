export interface EmailProvider {
  sendMagicLink(args: { email: string; magicLinkUrl: string }): Promise<void>;
}
