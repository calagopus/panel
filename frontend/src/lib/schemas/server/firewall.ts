import { z } from 'zod';
import { isNetwork } from '@/lib/network/ip.ts';
import { networkProtocol } from '@/lib/schemas/generic.ts';

export const serverFirewallRuleAction = z.enum(['allow', 'deny']);

export const serverFirewallRuleSchema = z.object({
  action: serverFirewallRuleAction,
  protocols: z.array(networkProtocol),
  sources: z.array(z.string().refine(isNetwork, { message: 'Invalid IP address or network' })),
  ports: z.array(z.number().int().min(1).max(65535)).min(1).max(1024).nullable(),
  sourceFile: z.string().trim().min(1).max(512).nullable(),
});

export const serverFirewallSchema = z.object({
  rules: z.array(serverFirewallRuleSchema),
  allocationPorts: z.array(z.number()),
  supported: z.boolean().nullable(),
});

export const serverFirewallEditSchema = z.object({
  rules: z.array(serverFirewallRuleSchema),
});
