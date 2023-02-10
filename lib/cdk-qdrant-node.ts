import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput, aws_ecs as ecs, aws_iam as iam, aws_ec2 as ec2, aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';

export class CdkQdrantNode extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "MyVpc", {
      maxAzs: 2,
    });

    // Security group for the public container
    const publicContainerSecurityGroup = new ec2.SecurityGroup(this, "PublicContainerSecurityGroup", {
      vpc,
      securityGroupName: "public-container-security-group",
    });

    publicContainerSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow incoming traffic on port 80"
    );

    // EC2 Cluster
    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc,
    });

    cluster.addCapacity('DefaultAutoScalingGroupCapacity', {
      instanceType: new ec2.InstanceType("t3.medium"),
      desiredCapacity: 1,
    });

    const taskRole = new iam.Role(this, 'AppRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
    });

    // Task definition for the first container
    const taskDefinitionQdrant = new ecs.Ec2TaskDefinition(this, "TaskDefinitionQdrant", {
      taskRole
    });

    const qdrantContainer = taskDefinitionQdrant.addContainer("QdrantContainer", {
      image: ecs.ContainerImage.fromRegistry("qdrant/qdrant"),
      logging: new ecs.AwsLogDriver({ streamPrefix: "qdrant-container" }),
      environment: {
        PORT: "6333",
      },
      portMappings: [{ containerPort: 6333 }],
      memoryLimitMiB: 1024,
      cpu: 1,
    });

    // Task definition for the second container
    const taskDefinitionNode = new ecs.Ec2TaskDefinition(this, "TaskDefinitionNode", {
      taskRole,
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    const nodeContainer = taskDefinitionNode.addContainer("NodeContainer", {
      image: ecs.ContainerImage.fromAsset('./SampleApp'),
      logging: new ecs.AwsLogDriver({ streamPrefix: "node-container" }),
      environment: {
        PORT: "80",
        QDRANT_API_ENDPOINT: `http://${qdrantContainer.containerName}:${qdrantContainer.containerPort}`,
      },
      portMappings: [{ containerPort: 80 }],
      essential: true,
      memoryLimitMiB: 1024,
      cpu: 1,
    });

    // Service for the second container
    const service = new ecs.Ec2Service(this, "Service", {
      taskDefinition: taskDefinitionNode,
      cluster,
      desiredCount: 2,
      securityGroups: [publicContainerSecurityGroup],
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
      port: 80,
      targets: [service],
    });
    new CfnOutput(this, "LoadBalancerDNS", {
      value: lb.loadBalancerDnsName,
    });
  }
}
