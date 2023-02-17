import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput, aws_ecs as ecs, aws_iam as iam, aws_ec2 as ec2, aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { Port } from 'aws-cdk-lib/aws-ec2';

export class CdkQdrantNode extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "MyVpc", {
      maxAzs: 2,
    });

    // Security group for the private container
    const publicContainerSecurityGroupQdrant = new ec2.SecurityGroup(this, "PublicContainerSecurityGroupQdrant", {
      vpc,
      securityGroupName: "public-container-security-group-qdrant",
    });

    publicContainerSecurityGroupQdrant.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(6333),
      "Allow incoming traffic on port 6333"
    );

    // Security group for the public container
    const publicContainerSecurityGroupNode = new ec2.SecurityGroup(this, "PublicContainerSecurityGroupNode", {
      vpc,
      securityGroupName: "public-container-security-group-node",
    });

    publicContainerSecurityGroupNode.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3000),
      "Allow incoming traffic on port 3000"
    );

    // EC2 Cluster
    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc,
    });

    cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
      instanceType: new ec2.InstanceType("t3.large"),
      desiredCapacity: 1,
    });

    const taskRole = new iam.Role(this, 'AppRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
    });

    // Task definition for the first container
    const taskDefinitionQdrant = new ecs.Ec2TaskDefinition(this, "TaskDefinitionQdrant", {
      taskRole,
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    const qdrantContainer = taskDefinitionQdrant.addContainer("QdrantContainer", {
      image: ecs.ContainerImage.fromRegistry("qdrant/qdrant"),
      logging: new ecs.AwsLogDriver({ streamPrefix: "qdrant-container" }),
      environment: {
        PORT: "6333",
      },
      portMappings: [{ containerPort: 6333 }],
      memoryLimitMiB: 2048,
      cpu: 1,
    });

    // Task definition for the second container
    const taskDefinitionNode = new ecs.Ec2TaskDefinition(this, "TaskDefinitionNode", {
      taskRole,
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    const nodeContainer = taskDefinitionNode.addContainer("NodeContainer", {
      image: ecs.ContainerImage.fromAsset('./backend'),
      logging: new ecs.AwsLogDriver({ streamPrefix: "node-container" }),
      environment: {
        POD_IP: "0.0.0.0",
        INTERNAL_QDRANT_HOST: `http://${qdrantContainer.containerName}:${qdrantContainer.containerPort}`,
        OPENAI_API_KEY: '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'
      },
      portMappings: [{ containerPort: 3000 }],
      essential: true,
      memoryLimitMiB: 2048,
      cpu: 1,
    });

    // Service for the first container
    const serviceQdrant = new ecs.Ec2Service(this, "ServiceQdrant", {
      taskDefinition: taskDefinitionQdrant,
      cluster,
      desiredCount: 1,
      securityGroups: [publicContainerSecurityGroupQdrant],
    });

    // Service for the second container
    const serviceNode = new ecs.Ec2Service(this, "ServiceNode", {
      taskDefinition: taskDefinitionNode,
      cluster,
      desiredCount: 1,
      securityGroups: [publicContainerSecurityGroupNode],
    });

    // Load Balancer for the second container
    const lb = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      internetFacing: true,
    });
    const listener = lb.addListener("Listener", {
      port: 80,

    });
    listener.addTargets("Target", {
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [serviceNode],
    });
    new CfnOutput(this, "LoadBalancerDNS", {
      value: lb.loadBalancerDnsName,
    });

    serviceQdrant.connections.allowFrom(lb, Port.tcp(6333));
  }
}
