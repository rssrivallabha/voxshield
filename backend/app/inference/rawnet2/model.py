import torch
import torch.nn as nn
import torch.nn.functional as F


class SincConv(nn.Module):
    def __init__(
        self,
        sinc_filters,
        sinc_filter_length,
        sample_rate,
        learnable_sinc=False,
    ):
        super().__init__()

        self.sinc_filters = sinc_filters
        self.sinc_filter_length = sinc_filter_length
        self.sample_rate = sample_rate

        low_hz = torch.full(
            (sinc_filters, 1),
            50.0,
            dtype=torch.float32,
        )

        band_hz = torch.full(
            (sinc_filters, 1),
            (sample_rate / 2 - 50.0),
            dtype=torch.float32,
        )

        self.low_hz_ = nn.Parameter(
            low_hz,
            requires_grad=bool(learnable_sinc),
        )

        self.band_hz_ = nn.Parameter(
            band_hz,
            requires_grad=bool(learnable_sinc),
        )

        # Checkpoint expects exactly 64 values.
        n_axis = torch.linspace(
            0.0,
            float(64 - 1),
            64,
            dtype=torch.float32,
        )

        n_axis = n_axis / float(sample_rate)

        self.n_axis = nn.Parameter(
            n_axis.view(1, -1),
            requires_grad=False,
        )

        # Checkpoint expects exactly 64 values.
        window = torch.hann_window(
            64,
            dtype=torch.float32,
        )

        self.window = nn.Parameter(
            window,
            requires_grad=False,
        )

    def _make_filters(self):
        eps = 1e-8

        low = self.low_hz_
        high = low + self.band_hz_

        # Shape: (1, 64)
        # Values: 0 ... 63 / sample_rate
        n = self.n_axis

        # filters: [sinc_filters, sinc_filter_length]
        filters = []

        for i in range(self.sinc_filters):

            l = low[i]
            h = high[i]

            # Band-pass sinc response.
            #
            # At n = 0, the analytical limit is:
            # 2 * (h - l)
            sinc_band = torch.where(
                n == 0,
                2.0 * (h - l),
                (
                    torch.sin(2.0 * torch.pi * h * n)
                    - torch.sin(2.0 * torch.pi * l * n)
                )
                / (torch.pi * n + eps),
            )

            sinc_band = sinc_band.squeeze(0)

            # Apply the stored one-sided window.
            sinc_band = sinc_band * self.window

            # 64 samples on the left.
            left = torch.flip(
                sinc_band,
                dims=[0],
            )

            # 64 samples on the right.
            right = sinc_band

            # One explicit center sample.
            center = (2.0 * (h - l)).reshape(1)

            # 64 + 1 + 64 = 129 taps.
            filt = torch.cat(
                [
                    left,
                    center,
                    right,
                ],
                dim=0,
            )

            filters.append(filt)

        return torch.stack(
            filters,
            dim=0,
        )

    def forward(self, x):
        filters = self._make_filters()

        return F.conv1d(
            x,
            filters.unsqueeze(1),
            stride=1,
            padding=self.sinc_filter_length // 2,
        )


class FMS(nn.Module):
    def __init__(self, channels):
        super().__init__()

        self.fc = nn.Linear(
            channels,
            channels,
        )

    def forward(self, x):
        # x shape: [B, C, T]
        s = x.mean(dim=2)          # [B, C]
        s = self.fc(s)             # [B, C]
        s = torch.sigmoid(s)
        s = s.unsqueeze(2)         # [B, C, 1]

        return x * s


class ResBlock(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()

        self.bn1 = nn.BatchNorm1d(in_channels)

        self.conv1 = nn.Conv1d(
            in_channels,
            out_channels,
            kernel_size=3,
            padding=1,
        )

        self.bn2 = nn.BatchNorm1d(out_channels)

        self.conv2 = nn.Conv1d(
            out_channels,
            out_channels,
            kernel_size=3,
            padding=1,
        )

        self.maxpool = nn.MaxPool1d(3)

        self.fms = FMS(out_channels)

        if in_channels != out_channels:
            self.shortcut = nn.Conv1d(
                in_channels,
                out_channels,
                kernel_size=1,
            )
        else:
            self.shortcut = nn.Identity()

    def forward(self, x):
        residual = x

        out = self.bn1(x)
        out = F.leaky_relu(
            out,
            negative_slope=0.3,
        )

        out = self.conv1(out)

        out = self.bn2(out)
        out = F.leaky_relu(
            out,
            negative_slope=0.3,
        )

        out = self.conv2(out)

        out = self.fms(out)

        out = out + self.shortcut(residual)

        out = self.maxpool(out)

        return out


class RawNet2Model(nn.Module):
    def __init__(self, config):
        super().__init__()

        self.sinc_filters = config["sinc_filters"]
        self.sinc_filter_length = config["sinc_filter_length"]
        self.sample_rate = config["sample_rate"]
        self.sinc_scale = config["sinc_scale"]
        self.learnable_sinc = config["learnable_sinc"]

        self.first_block_channels = config["first_block_channels"]
        self.second_block_channels = config["second_block_channels"]

        self.num_first_blocks = config["num_first_blocks"]
        self.num_second_blocks = config["num_second_blocks"]

        self.gru_hidden = config["gru_hidden"]
        self.embedding_dim = config["embedding_dim"]

        cw = torch.tensor(
            config["class_weights"],
            dtype=torch.float32,
        )

        self.class_weights = nn.Parameter(
            cw,
            requires_grad=False,
        )

        self.sinc = SincConv(
            self.sinc_filters,
            self.sinc_filter_length,
            self.sample_rate,
            learnable_sinc=self.learnable_sinc,
        )

        self.front_bn = nn.BatchNorm1d(
            self.sinc_filters,
        )

        blocks = []

        in_ch = self.sinc_filters

        for _ in range(self.num_first_blocks):
            out_ch = self.first_block_channels

            blocks.append(
                ResBlock(
                    in_ch,
                    out_ch,
                )
            )

            in_ch = out_ch

        for _ in range(self.num_second_blocks):
            out_ch = self.second_block_channels

            blocks.append(
                ResBlock(
                    in_ch,
                    out_ch,
                )
            )

            in_ch = out_ch

        self.blocks = nn.ModuleList(blocks)

        self.pre_gru_bn = nn.BatchNorm1d(
            in_ch,
        )

        self.gru = nn.GRU(
            in_ch,
            self.gru_hidden,
            batch_first=True,
        )

        self.fc = nn.Linear(
            self.gru_hidden,
            self.embedding_dim,
        )

        self.classifier = nn.Linear(
            self.embedding_dim,
            2,
        )

    def forward(self, x_dict):
        x = x_dict["waveform"]

        x = x.unsqueeze(1)

        x = self.sinc(x)

        x = self.front_bn(x)

        for block in self.blocks:
            x = block(x)

        x = self.pre_gru_bn(x)

        x = x.permute(
            0,
            2,
            1,
        )

        x, _ = self.gru(x)

        x = self.fc(
            x[:, -1, :]
        )

        x = self.classifier(x)

        return {
            "logits": x,
        }